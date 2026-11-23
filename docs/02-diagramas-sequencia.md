# 02. Diagramas de sequência

Diagramas dos fluxos mais importantes do sistema, todos passando pelo gateway (única porta de
entrada do frontend para o backend). Fontes: casos de uso em `backend/application/{auth,eligibility,scheduling}`
(`RegisterDonorUseCase`, `CreateAppointmentUseCase`, `CompleteAppointmentUseCase`, `AssessEligibilityUseCase`,
`CreateCampaignUseCase`), `NotificationQueuePublisher` (infrastructure) e `NotificationsProcessor` (presentation) (ver `01-modelagem-entidades.md` para as entidades envolvidas).

## 1. Cadastro de doador (saga com resultado sempre resolvível)

O `auth-service` cria o `User` primeiro (para já poder emitir os tokens) e pede o `Donor` ao
`eligibility-service`. Não há transação entre os dois, então o que fazer numa falha depende do que
se sabe do resultado: um **conflito** (CPF já cadastrado) é definitivo e o `User` é desfeito; já um
timeout ou resposta perdida é **incerto** (o `Donor` pode ter sido criado), e o auth pergunta ao
eligibility por `GET /donors/internal/by-user/:userId`. Se o `Donor` existe, o cadastro é concluído
(roll-forward); se não existe, o `User` é desfeito. Se nem a consulta responder, o `User` fica
pendente e o job de reconciliação (a cada minuto, depois de 2 minutos de carência) resolve do mesmo
jeito, inclusive após uma queda do processo. Assim nunca sobra `Donor` sem `User`, nem `User`
pendente para sempre.

Se o cliente repetir o cadastro enquanto o `User` ainda está pendente, o auth não responde "e-mail já
cadastrado": quando o e-mail pertence a um doador sem `Donor` vinculado **e a senha enviada confere**, o
cadastro é retomado (consulta se o `Donor` já existe e só o cria se não existir). Com senha diferente, ou
com `User` já vinculado, continua sendo conflito.

```mermaid
sequenceDiagram
    actor Donor
    participant FE as Frontend
    participant GW as Gateway
    participant Auth as auth-service
    participant Elig as eligibility-service

    Donor->>FE: preenche formulário de cadastro
    FE->>GW: POST /auth/register
    GW->>Auth: POST /auth/register
    Auth->>Auth: valida e-mail disponível, hash da senha
    Auth->>Auth: salva User (role=donor)
    Auth->>Elig: POST /donors (x-internal-api-key)
    alt sucesso
        Elig->>Elig: valida CPF/userId únicos, salva Donor
        Elig-->>Auth: 201 Donor criado
        Auth->>Auth: emite access + refresh token
        Auth-->>GW: 201 AuthResponseDto
        GW-->>FE: 201 AuthResponseDto
        FE-->>Donor: logado, redireciona para /appointments
    else falha (CPF duplicado, serviço fora do ar etc.)
        Elig-->>Auth: erro (409 ou falha de rede)
        alt conflito (409): resultado definitivo
            Auth->>Auth: DELETE User recém-criado
        else resultado incerto (timeout, 5xx)
            Auth->>Elig: GET /donors/internal/by-user/:userId
            alt Donor existe
                Auth->>Auth: vincula o Donor e conclui o cadastro (roll-forward)
            else Donor não existe
                Auth->>Auth: DELETE User recém-criado
            else consulta também falha
                Auth->>Auth: mantém o User pendente (reconciliação resolve depois)
            end
        end
        Auth-->>GW: erro propagado (se não concluiu)
        GW-->>FE: erro propagado
        FE-->>Donor: mensagem de erro, tente novamente
    end
```

## 2. Criar agendamento (avaliação de elegibilidade síncrona + lock de vaga)

A avaliação de elegibilidade acontece **dentro** da requisição de criação do agendamento (não é
assíncrona) - por isso o status já nasce `ELIGIBILITY_CONFIRMED` ou `ELIGIBILITY_DENIED`, e
o frontend mostra o resultado imediatamente. Ver `01-modelagem-entidades.md`, seção 5.3, para o
detalhe do advisory lock usado para evitar overbooking.

```mermaid
sequenceDiagram
    actor Donor
    participant FE as Frontend
    participant GW as Gateway
    participant Sched as scheduling-service
    participant Elig as eligibility-service
    participant Redis as Redis (BullMQ)

    Donor->>FE: escolhe unidade, data/horário (e campanha, opcional)
    FE->>GW: POST /appointments
    GW->>Sched: POST /appointments (com o JWT do doador)
    Sched->>Sched: valida horário da grade (30 min), unidade ativa e aberta no horário, campanha ativa (se informada)
    Sched->>Sched: pg_advisory_xact_lock(doador) e recusa se o doador já tem agendamento em aberto
    Sched->>Sched: pg_advisory_xact_lock(unidade+horário)
    Sched->>Sched: conta vagas ocupadas no horário
    alt sem vaga
        Sched-->>GW: 409 Não há vagas disponíveis
        GW-->>FE: 409
    else vaga disponível
        Sched->>Sched: salva Appointment (status=SCHEDULED)
        Sched->>Elig: POST /eligibility/internal/assess (origin=APPOINTMENT_VALIDATION)
        alt chamada falha (não "nega" - falha mesmo)
            Elig-->>Sched: erro de rede/serviço
            Sched->>Sched: apaga o Appointment (compensação)
            Sched-->>GW: erro propagado
        else avaliação concluída
            Elig->>Elig: calcula idade, peso, inaptidão temporária, intervalo mínimo
            Elig->>Elig: salva EligibilityAssessment
            Elig-->>Sched: resultado (ELIGIBLE | TEMPORARY_UNFIT | PERMANENT_UNFIT)
            Sched->>Sched: status = ELIGIBILITY_CONFIRMED | ELIGIBILITY_DENIED
            opt elegibilidade confirmada
                Sched->>Redis: enfileira job REMINDER_24H (delay até 24h antes)
            end
            Sched-->>GW: 201 Appointment + avaliação
        end
    end
    GW-->>FE: resposta
    FE-->>Donor: mostra resultado da avaliação
```

## 3. Check-in e conclusão (admin) - atualização pós-doação

```mermaid
sequenceDiagram
    actor Admin
    participant FE as Frontend
    participant GW as Gateway
    participant Sched as scheduling-service
    participant Elig as eligibility-service
    participant Redis as Redis (BullMQ)

    Admin->>FE: clica "Check-in" (agendamento ELIGIBILITY_CONFIRMED ou CONFIRMED, no dia dele)
    FE->>GW: POST /appointments/:id/checkin
    GW->>Sched: POST /appointments/:id/checkin
    alt não é o dia do agendamento (Brasília)
        Sched-->>FE: 409 "O check-in só pode ser feito no dia do agendamento"
    end
    Sched->>Elig: POST /eligibility/internal/assess (APPOINTMENT_VALIDATION, donationDate = hoje)
    alt doador não está mais apto
        Sched-->>FE: 409 (a avaliação fica no histórico do doador; a equipe cancela o agendamento)
    end
    Sched->>Sched: status = CHECKIN_PERFORMED, checkinAt = agora
    Sched-->>FE: 200 (via GW)

    Admin->>FE: clica "Concluir" (agendamento CHECKIN_PERFORMED)
    FE->>GW: POST /appointments/:id/complete
    GW->>Sched: POST /appointments/:id/complete
    Sched->>Sched: status = COMPLETED, completedAt = agora
    Sched-->>FE: 200 (resposta já retorna, não espera o resto)
    par melhor esforço, assíncrono
        Sched->>Elig: POST /donors/:id/donations/complete (atualiza lastDonationAt)
        Sched->>Elig: POST /eligibility/internal/assess (origin=DONOR_QUERY, recalcula próxima data)
        Sched->>Redis: enfileira job INTERVAL_COMPLETED (avisa doador da próxima data elegível)
    end
```

## 3.1 Confirmação de presença (48h / 24h)

Ao criar o agendamento, o scheduling-service enfileira dois jobs atrasados: o pedido de confirmação
(48h antes, jobId `confirmation-<id>`) e o lembrete (24h antes, jobId `reminder-<id>`), ambos com o link
com token. Se faltar menos de 24h, só o lembrete é enviado (sem e-mail duplicado).

```mermaid
sequenceDiagram
    actor Donor
    participant FE as Frontend
    participant Sched as scheduling-service
    participant Redis as Redis (BullMQ)

    Redis-->>Donor: e-mail 48h antes (link /confirm-attendance?token=...)
    Donor->>FE: abre o link e clica "Confirmar presença"
    FE->>Sched: POST /appointments/confirm-attendance {token}
    Sched->>Sched: verifica HMAC e validade; ELIGIBILITY_CONFIRMED -> CONFIRMED, confirmedAt = agora
    Sched->>Redis: remove job de pedido; zera o link do lembrete de 24h
    Sched-->>FE: 200 {id, dateTime, status, confirmedAt}
```

A confirmação só ocorre ao clicar no botão (scanners de e-mail que abrem o link não confirmam).
Quem não confirma continua com a vaga e aparece destacado ("Aguardando confirmação") para o admin.
O cancelamento do agendamento remove os dois jobs pendentes.

## 4. Campanha urgente - notificação assíncrona em massa

Diferente do lembrete individual (item 2), a notificação de campanha é para **muitos** doadores
de uma vez - por isso é sempre assíncrona e resolvida fora do caminho crítico de criar a
campanha (o admin não espera o disparo de e-mails para receber a resposta).

```mermaid
sequenceDiagram
    actor Admin
    participant FE as Frontend
    participant GW as Gateway
    participant Sched as scheduling-service
    participant Elig as eligibility-service
    participant Redis as Redis (BullMQ)
    participant Notif as notification-service (worker)

    Admin->>FE: cria campanha (tipo URGENT)
    FE->>GW: POST /campaigns
    GW->>Sched: POST /campaigns
    Sched->>Sched: salva Campaign
    Sched-->>GW: 201 Campaign (resposta já volta aqui)
    GW-->>FE: 201

    Note over Sched: notificação disparada em background,<br/>best-effort (não bloqueia a criação)
    Sched->>Elig: GET /donors/internal/contacts?bloodType=... (x-internal-api-key)
    Elig-->>Sched: lista de {id, nome, e-mail, tipo sanguíneo} dos doadores ativos compatíveis
    Sched->>Redis: enfileira 1 job URGENT_CAMPAIGN (payload já com todos os destinatários)
    Redis-->>Notif: worker consome o job
    loop para cada destinatário
        Notif->>Notif: "envia" e-mail (simulado - loga a mensagem)
        Notif->>Notif: grava NotificationLog (status SENT ou FALHOU)
    end
```

## 5. Login e renovação de token (refresh)

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant GW as Gateway
    participant Auth as auth-service

    User->>FE: e-mail + senha
    FE->>GW: POST /auth/login
    GW->>Auth: POST /auth/login
    Auth->>Auth: valida senha (bcrypt), gera access token (15min) + refresh token (7d)
    Auth->>Auth: salva hash SHA-256 do refresh token
    Auth-->>FE: accessToken + dados do usuário no corpo; refresh token em cookie httpOnly (Set-Cookie, via GW)
    FE->>FE: guarda o access token só em memória (localStorage guarda apenas o perfil)

    Note over FE: em qualquer requisição autenticada depois...
    FE->>GW: requisição com Authorization: Bearer <accessToken>
    alt access token válido
        GW-->>FE: 200
    else access token expirado (401)
        FE->>GW: POST /auth/refresh (o navegador envia o cookie httpOnly)
        GW->>Auth: POST /auth/refresh
        Auth->>Auth: valida hash, não revogado, não expirado
        Auth->>Auth: rotaciona: revoga o antigo, emite um novo par
        Auth-->>FE: novo accessToken no corpo + novo cookie (via GW)
        FE->>FE: atualiza a store, refaz a requisição original
    end
```

O interceptor do axios no frontend (`shared/api/http.ts`) usa uma única promise compartilhada
para deduplicar renovações simultâneas: se várias requisições caírem em 401 ao mesmo tempo, só
uma chamada a `/auth/refresh` é feita, e todas aguardam o mesmo resultado. Ao recarregar a página
o access token (só em memória) não existe mais: o primeiro 401 dispara a renovação silenciosa pelo cookie.
