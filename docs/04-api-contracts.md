# 04. Contratos de API

Referência rápida de todos os endpoints expostos pelo gateway. **Fonte definitiva**: o Swagger de
cada serviço (`/docs`, ver `README.md` na raiz), gerado a partir dos DTOs com `class-validator` -
este documento é um índice para navegação, não substitui o Swagger para detalhes de payload.

O frontend fala **só** com o gateway (`http://localhost:3000` por padrão), nunca diretamente com
um serviço - o gateway apenas repassa a requisição para o serviço de destino, sem reescrever o
path (tabela completa em `backend/infrastructure/gateway/proxy/proxy-routes.ts`):

| Prefixo            | Serviço de destino    |
| -------------------- | ------------------------ |
| `/auth`                | auth-service                |
| `/donors`             | eligibility-service           |
| `/eligibility`         | eligibility-service           |
| `/collection-units`        | scheduling-service            |
| `/campaigns`               | scheduling-service            |
| `/appointments`             | scheduling-service            |

## Legenda de autenticação

- **público**: sem token.
- **JWT**: exige `Authorization: Bearer <accessToken>` de um usuário autenticado (qualquer papel).
- **JWT admin**: JWT + papel `admin` (`RolesGuard` + `@Roles(Role.ADMIN)`).
- **dono ou admin**: JWT de qualquer papel, mas o backend confere que o `donorId` do token bate
  com o recurso acessado, a menos que o token seja de um admin (`requireOwnerOrAdmin`, aplicado nos casos de uso).
- **bootstrap**: público **só enquanto nenhum admin existir** no banco; depois disso, exige JWT
  admin (`BootstrapOrAdminGuard` - ver `01-entity-modeling.md`, seção 7).
- **interno**: não é exposto ao frontend (o gateway responde 404 a essas rotas); só outro serviço pode chamar, com um header
  `x-internal-api-key` válido (`InternalApiKeyGuard`).

## `auth` (auth-service)

| Método e path        | Auth       | Descrição                                                          |
| ----------------------- | ------------ | ---------------------------------------------------------------------- |
| `POST /auth/register`     | público        | Cadastro de doador - cria `User` + `Donor` (via eligibility-service) e já retorna tokens. Pede as declarações exigidas pela idade, a última doação e o tipo sanguíneo (opcionais) e o consentimento para o uso dos dados de saúde (`healthDataConsent: true`, obrigatório - LGPD; ver `03-eligibility-rules.md`) |
| `POST /auth/admin`          | bootstrap      | Cadastro de admin - o primeiro exige o header `x-setup-token` (= `ADMIN_SETUP_TOKEN`); depois exige JWT admin. 10 req/15min por IP |
| `POST /auth/login`            | público        | Retorna o access token no corpo e grava o refresh token em cookie httpOnly. 10 req/15min por IP; conta bloqueada 15 min após 5 senhas erradas seguidas (429) |
| `POST /auth/refresh`            | cookie*       | Rotaciona o refresh token (*lido do cookie httpOnly `doesangue_rt`, sem corpo; a `Origin`, se houver, precisa estar em `CORS_ORIGINS`) |
| `POST /auth/logout`               | JWT            | Revoga o refresh token do cookie e limpa o cookie                     |
| `GET /auth/me`                      | JWT            | Dados do usuário autenticado (inclui `emailVerified` e `pendingEmail`) |
| `POST /auth/verify-email`           | público (token) | Confirma o e-mail pelo token do link (`{ token }`): o do cadastro ou o novo, pedido numa troca (que só então é concluída). `200 { email, changed }`; `400` link inválido, expirado (48 h) ou de um e-mail que já não é o da conta; `409` e-mail novo tomado por outra conta. 10 req / 15min |
| `POST /auth/me/resend-verification` | JWT            | Reenvia o link de confirmação: para o e-mail pendente, se há troca; senão, para o atual não confirmado. `200 { sentTo }` (`null` se não há o que confirmar). 3 req / 15min |
| `PATCH /auth/me`                    | JWT            | Troca nome e/ou e-mail da própria conta (no doador, o nome também no eligibility). Trocar o e-mail exige `currentPassword` e não é imediato: o novo fica em `pendingEmail` e recebe um link de confirmação; a conta continua com o atual até o link ser aberto (`POST /auth/verify-email`). 10 req / 15min |
| `POST /auth/forgot-password`          | público      | Solicita redefinição de senha - resposta sempre genérica (não revela se o e-mail existe); ver nota abaixo sobre o token. Limitado a 5 req/15min por IP |
| `POST /auth/reset-password`             | público      | Redefine a senha usando o token gerado por `/auth/forgot-password` (válido por 15min); revoga os refresh tokens ativos do usuário. Limitado a 10 req/15min por IP |
| `GET /auth/admins`                        | JWT admin      | Lista todos os usuários admin                                          |
| `POST /auth/admins/:id/deactivate`           | JWT admin      | Desativa outro admin (bloqueado para a própria conta e para o último admin ativo) |
| `POST /auth/admins/:id/reactivate`              | JWT admin      | Reativa um admin previamente desativado                                  |
| `POST /auth/me/delete-data`                   | JWT (só `donor`) | **[LGPD]** Solicita a exclusão (anonimização) dos próprios dados. Corpo: `{ currentPassword }` (senha atual; limite de 5 tentativas / 15 min). Orquestra a anonimização no eligibility-service, revoga sessões e limpa o cookie - ver `01-entity-modeling.md`, seção 8.4 |

Nota sobre `/auth/forgot-password`: quando o e-mail existe, o token de redefinição é sempre
enfileirado para envio real por e-mail (via `notification-service`/`NodemailerMailSender`, SMTP - ver
`01-entity-modeling.md`, seção 6). O token só volta também no corpo da resposta
(`resetToken`) quando nenhum provedor SMTP real está configurado (`SMTP_HOST` vazio - modo
simulado, padrão em dev/CI) e o serviço não está em produção; com SMTP configurado, o token nunca é
retornado pela API, só chega por e-mail. Em produção (`NODE_ENV=production`) sem SMTP, o token também
não volta na resposta: o link fica só no log do auth-service.

## `donors` e `elegibilidade` (eligibility-service)

| Método e path                            | Auth           | Descrição                                                        |
| -------------------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| `POST /donors`                               | interno            | Cria o `Donor` associado a um `User` recém-cadastrado                |
| `GET /donors/me`                               | JWT                | Perfil do doador autenticado                                            |
| `GET /donors`                                    | JWT admin          | Busca/lista doadores por nome ou CPF (parcial) - painel admin. Com `ids` (até 100, separados por vírgula), devolve esses doadores, ex.: os nomes da lista de agendamentos. Cada doador exibido entra na auditoria (`SEARCH`) |
| `GET /donors/internal/contacts`                    | interno              | Contatos dos doadores ativos, aptos hoje e que aceitam avisos (`receiveAlerts`), opcionalmente de um tipo sanguíneo - usado para notificação de campanha |
| `GET /donors/internal/:id/contact`                 | interno              | Nome, e-mail e `active` de um doador (404 se não existe) - usado pelo scheduling nos e-mails do agendamento |
| `POST /donors/alerts/unsubscribe`                  | público (token)      | Desliga os avisos de campanha e de "já pode doar" do doador do link. Token na URL (`?token=`, botão de um clique do Gmail/Outlook) ou no corpo `{token}` (página `/unsubscribe`). `204`; `400` token inválido. 20 req / 15min por IP |
| `GET /donors/internal/by-user/:userId`             | interno              | Id do doador de um usuário (404 se não existe) - usado pelo auth para resolver um cadastro de resultado incerto |
| `PATCH /donors/internal/:id/identity`              | interno              | Troca nome e/ou e-mail do doador - chamado pelo auth em `PATCH /auth/me` |
| `GET /donors/:id`                                    | dono ou admin          | Perfil de um doador específico                                            |
| `PATCH /donors/:id`                                    | dono ou admin          | Atualiza CPF, data de nascimento, sexo, telefone (`null` apaga), peso, tipo sanguíneo, a última doação (só avança: não pode ser anterior à já registrada) e as declarações (responsável legal, doação antes dos 60, doador regular) e a preferência de avisos por e-mail (`receiveAlerts`). Nome e e-mail: `PATCH /auth/me`. Status e consentimento não são editáveis |
| `POST /donors/:id/medical-clearance`                   | JWT admin              | Registra a avaliação médica favorável de um doador regular com 70 anos ou mais |
| `DELETE /donors/:id/medical-clearance`                 | JWT admin              | Desfaz a avaliação médica registrada                                          |
| `POST /donors/:id/unfitness`                           | JWT admin              | Registra um período de inaptidão temporária                                |
| `GET /donors/:id/unfitness`                              | dono ou admin          | Lista os períodos de inaptidão do doador                                    |
| `PATCH /donors/:id/unfitness/:unfitnessId/end`       | JWT admin              | Encerra antecipadamente um período de inaptidão temporária em aberto (`actualEndDate` nula) |
| `DELETE /donors/:id/unfitness/:unfitnessId`          | JWT admin              | Exclui uma inaptidão temporária registrada por engano (204); a ação fica no log de auditoria |
| `GET /donors/:id/export`                                     | dono ou admin          | **[LGPD]** Exporta (portabilidade) cadastro + inaptidões + avaliações do doador |
| `POST /donors/:id/anonymize`                                    | interno                | **[LGPD, interno]** Anonimiza nome/CPF/telefone/e-mail do doador; chamado por `POST /auth/me/delete-data` |
| `GET /donors/:id/audit`                                        | JWT admin              | Log de auditoria de acesso ao perfil deste doador (quem viu/alterou, quando) |
| `POST /donors/:id/donations/complete`                          | interno                  | Atualiza `lastDonationAt` (corpo opcional `{ donationDate: AAAA-MM-DD }`); idempotente, nunca recua a data |
| `POST /eligibility/assess`                                    | dono ou admin          | Consulta a elegibilidade agora ("Posso doar hoje?"); só responde, **não grava** (sem `id`). Só `origin = DONOR_QUERY`; as avaliações de agendamento e de pós-doação vêm do scheduling pela rota interna `POST /eligibility/internal/assess`, que aceita `appointmentId` e `donationDate`) |
| `GET /eligibility/:donorId/history`                           | JWT admin              | Avaliações registradas do doador (agendamentos e pós-doação), para conferir por que um agendamento foi aceito |

Nota sobre exportação completa: o front (`ProfilePage`) combina `GET /donors/:id/export` com
`GET /auth/me` e `GET /appointments/me` num único arquivo baixado pelo doador - não existe um
endpoint único de agregação entre os três serviços (ver `01-entity-modeling.md`, seção 8.4).

## `unidades-coleta` (scheduling-service)

| Método e path                          | Auth        | Descrição                                              |
| ------------------------------------------ | ------------- | ----------------------------------------------------------- |
| `GET /collection-units`                       | público         | Lista unidades **ativas** - usado no fluxo de agendamento     |
| `GET /collection-units/admin/all`             | JWT admin         | Lista todas as unidades, incluindo desativadas - para reativação |
| `GET /collection-units/:id`                       | público         | Detalhe de uma unidade                                         |
| `POST /collection-units`                            | JWT admin         | Cadastra uma unidade                                            |
| `DELETE /collection-units/:id`                        | JWT admin         | Desativa uma unidade (não apaga - preserva histórico) e cancela os agendamentos dela ainda por vir, sem check-in (motivo "Unidade de coleta desativada.") |
| `POST /collection-units/:id/reactivate`                   | JWT admin         | Reativa uma unidade previamente desativada                        |

## `campaigns` (scheduling-service)

| Método e path             | Auth        | Descrição                                                          |
| ------------------------------ | ------------- | ---------------------------------------------------------------------- |
| `GET /campaigns`                 | público         | Lista campanhas ativas - usado na home do portal do doador                |
| `GET /campaigns/:id`                | público         | Detalhe de uma campanha                                                  |
| `POST /campaigns`                     | JWT admin         | Cria uma campanha (`REGULAR` ou `URGENT`, tipo sanguíneo opcional); `URGENT` dispara notificação assíncrona (ver `02-sequence-diagram.md`, item 4) |
| `DELETE /campaigns/:id`                 | JWT admin         | Desativa uma campanha                                                     |

## `appointments` (scheduling-service)

Todas as rotas exigem JWT, exceto `POST /appointments/confirm-attendance` (público, protegido pelo token HMAC do link do e-mail).

| Método e path                     | Auth        | Descrição                                                       |
| ---------------------------------- | ------------- | --------------------------------------------------------------------- |
| `GET /appointments/availability`   | JWT               | Vagas ocupadas/disponíveis por horário, numa unidade e data              |
| `GET /appointments/me`                  | JWT               | Histórico de agendamentos do doador autenticado                          |
| `GET /appointments`                       | JWT admin          | Lista agendamentos com filtros opcionais (`status`, `collectionUnitId`, `data`) |
| `POST /appointments`                        | JWT               | Cria um agendamento (avalia elegibilidade de forma síncrona - ver `02-sequence-diagram.md`, item 2). O horário segue a grade de 30 min e o horário de funcionamento da unidade, se cadastrado; um doador só tem um agendamento em aberto por vez |
| `GET /appointments/:id`                       | dono ou admin      | Detalhe de um agendamento                                                |
| `POST /appointments/:id/cancel`               | dono ou admin      | Cancela. O doador: antes do horário e do check-in. O admin: também depois deles. Agendamentos encerrados (`COMPLETED`, `NO_SHOW`, `ELIGIBILITY_DENIED`, `CANCELED`) não são cancelados |
| `POST /appointments/internal/donors-with-open-appointment` | interno | Dos `donorIds` do corpo (até 5000), devolve os que têm agendamento em aberto - usado pelo eligibility para não mandar "já pode doar" a quem já agendou |
| `POST /appointments/internal/donors/:donorId/cancel-open` | interno | **[LGPD, interno]** Cancela os agendamentos em aberto do doador e remove os lembretes; chamado pelo auth-service na exclusão da conta |
| `POST /appointments/:id/confirm-attendance`      | dono ou admin      | Confirma a presença (`ELIGIBILITY_CONFIRMED` → `CONFIRMED`, idempotente); retorna `{id, dateTime, status, confirmedAt}` |
| `POST /appointments/confirm-attendance`          | público (token)    | Corpo `{token}`. Confirma pelo link do e-mail; `400` token inválido, `410` token expirado (após o horário do agendamento) |
| `POST /appointments/:id/checkin`                  | JWT admin          | Registra o check-in (exige `ELIGIBILITY_CONFIRMED` ou `CONFIRMED` e que seja o dia do agendamento, no horário de Brasília) depois de reavaliar a elegibilidade para hoje; a doação concluída é registrada no dia do agendamento; `409` se o doador não está mais apto |
| `POST /appointments/:id/complete`                   | JWT admin          | Conclui a doação (exige `CHECKIN_PERFORMED`) - ver `02-sequence-diagram.md`, item 3 |
| `GET /outbox/failures`                                | JWT admin          | Lista eventos do outbox que esgotaram as tentativas |
| `POST /outbox/:id/reprocess`                      | JWT admin          | Devolve um evento em `FAILURE` para a fila |
| `POST /outbox/reconcile`                          | JWT admin          | Executa já a reconciliação do outbox (roda sozinha a cada 10 min) |
| `POST /appointments/:id/no-show`               | JWT admin          | Marca como não comparecido (exige `ELIGIBILITY_CONFIRMED` ou `CONFIRMED` e `dateTime` já no passado) |

## `notifications` (notification-service)

| Método e path                                   | Auth               | Descrição |
| ----------------------------------------------- | ------------------ | --------- |
| `GET /notifications/sent?status=&page=`          | JWT admin          | Registro de envios, mais recentes primeiro (50 por página); destinatário e erro mascarados. `status`: `SENT`, `FAILURE`, `SUPPRESSED` |
| `GET /notifications/failed-jobs`                 | JWT admin          | E-mails que esgotaram as tentativas (guardados 7 dias) |
| `POST /notifications/failed-jobs/:id/retry`      | JWT admin          | Devolve o job à fila (`404` se não está mais em falha) |
| `GET /notifications/suppressed`                  | JWT admin          | Endereços bloqueados (devolveram e-mail ou marcaram spam) |
| `DELETE /notifications/suppressed/:email`        | JWT admin          | Desbloqueia um endereço (`404` se não está bloqueado) |
| `POST /notifications/webhooks/mail?token=`       | segredo na URL     | Eventos do provedor de e-mail (`{event, email}` ou lista); bloqueia `hard_bounce`, `invalid_email`, `blocked`, `spam`. `404` sem `MAIL_WEBHOOK_SECRET`, `403` token errado |

## Health checks

Todo serviço (gateway incluso) expõe `GET /health` (público, sem prefixo de roteamento - não passa
pelo gateway como as rotas de negócio) com uma checagem real de suas dependências (Postgres/Redis,
ou o `/health` dos serviços de destino no caso do gateway) - ver `docs/05-observability.md` para
detalhes de cada indicador e o formato da resposta. Responde `503` quando alguma dependência está
fora do ar.

## Erros

Todos os serviços usam o `ValidationPipe` global do Nest (`whitelist: true,
forbidNonWhitelisted: true, transform: true`) - um payload com campo extra ou de tipo errado
recebe `400` com a lista de mensagens de validação (`class-validator`) antes mesmo de chegar no
controller. O formato de erro é o padrão do Nest:

```json
{ "statusCode": 400, "message": ["email deve ser um e-mail válido"], "error": "Bad Request" }
```

O frontend centraliza a extração dessa mensagem em `shared/api/http.ts` (`extractErrorMessage`) -
`message` pode ser uma string única ou um array, dependendo de quantas regras falharam.
