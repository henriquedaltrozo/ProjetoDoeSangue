# 03. Regras de elegibilidade

O motor de elegibilidade vive inteiro em `eligibility-service` (função de domínio `assessEligibility`, em `backend/services/eligibility/src/domain/services/assess-eligibility.ts`, orquestrada por `AssessEligibilityUseCase`) e
é a única fonte de verdade sobre se um doador pode doar agora. Ele é chamado de dois lugares:

- Pelo próprio doador, ao consultar o perfil/histórico (`origin = DONOR_QUERY`).
- Pelo `scheduling-service`, ao criar um agendamento (`origin = APPOINTMENT_VALIDATION`) e ao
  concluir uma doação, para recalcular a próxima data elegível (`origin = DONOR_QUERY`).

Toda avaliação gera uma linha em `eligibility_assessments` (nunca sobrescreve uma anterior) - ver
`01-entity-modeling.md`, seção 4.3.

## Valores de referência

```ts
MIN_AGE_YEARS = 16
ADULT_AGE_YEARS = 18                     // abaixo disso, precisa do consentimento do responsável legal
MAX_AGE_YEARS = 69                       // até 69 anos, 11 meses e 29 dias (70+ só com a exceção abaixo)
MAX_AGE_FIRST_DONATION_YEARS = 60        // a partir dos 60, só quem já doou antes dos 60
MIN_WEIGHT_KG = 50
MIN_INTERVAL_MONTHS_MALE = 2
MIN_INTERVAL_MONTHS_FEMALE = 3
MAX_DONATIONS_PER_12_MONTHS_MALE = 4
MAX_DONATIONS_PER_12_MONTHS_FEMALE = 3
```

Esses valores seguem a Portaria GM/MS nº 11.685, de 2 de julho de 2026 (Anexo I, incorporado como Anexo IV-B
da Portaria de Consolidação GM/MS nº 5/2017), em vigor desde 30/09/2026: idade (art. 39), peso mínimo
(art. 40) e intervalo mínimo e máximo anual de doações de sangue total (art. 38). O intervalo é contado em
meses de calendário (uma doação em 02/08 libera o homem em 02/10); quando o dia não existe no mês de destino,
vale o último dia do mês. Não cobertos (ficam fora do escopo implementado): exceção de peso por
avaliação médica, doação por aférese e a lista de condições clínicas.

## Regras de idade

O doador pode doar dos 16 aos 69 anos, 11 meses e 29 dias, com três condições:

| Idade (anos completos) | Condição                                                                                         | Motivo quando não cumprida        |
| ---------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------- |
| menos de 16            | não pode doar; a próxima data elegível é o aniversário de 16 anos                                | `AGE_BELOW_MIN`                    |
| 16 e 17                | responsável legal informado e termo de consentimento confirmado; fica apto, com o aviso `BRING_GUARDIAN_CONSENT` (levar o termo assinado no dia) | `GUARDIAN_CONSENT_REQUIRED`        |
| 60 a 69                | já ter doado antes dos 60 anos                                                                    | `AGE_ABOVE_MAX_FIRST_DONATION`     |
| 70 ou mais             | ser doador voluntário regular **e** ter avaliação médica favorável válida (12 meses) registrada pelo admin | `AGE_ABOVE_MAX` (não é regular) ou `MEDICAL_CLEARANCE_REQUIRED` (regular, sem avaliação válida) |

**A idade conta no dia da doação.** Ao criar um agendamento, o scheduling envia o dia do agendamento
(`donationDate`, no horário de Brasília) e o motor confere as regras de idade e a validade da
avaliação médica nesse dia. Quem tem 69 anos e agenda para depois do aniversário de 70 é avaliado
com 70; quem tem 15 e agenda para depois dos 16 pode doar. Sem `donationDate` (consulta do próprio
doador), ou com um dia já passado, vale o dia de hoje. As demais regras (intervalo, limite anual,
inaptidão temporária) continuam conferidas na data de hoje.

A regra dos 60 vale a partir do aniversário de 60 anos (uma versão anterior só a aplicava a partir
dos 61). "Já doou antes dos 60" é verdadeiro quando o doador declarou isso **ou** quando o sistema
conhece uma doação dele anterior ao aniversário de 60 anos (`lastDonationAt` ou `donationDates`).
Uma doação feita depois dos 60 não prova nada sozinha. Como o sistema só guarda a última doação e as
dos últimos 12 meses, ao registrar uma doação anterior aos 60 (no cadastro ou ao concluir um
agendamento) o doador passa a ter `donatedBefore60 = true`, e o fato não se perde.

Todos esses motivos são inaptidões **temporárias**: cada um pode mudar por uma declaração do doador,
pela avaliação médica ou pelo aniversário.

### Declarações do doador

O sistema não tem o histórico de doações feitas fora dele, então o próprio doador declara o que a
regra de idade precisa. O cadastro (`POST /auth/register`) pede, conforme a idade na data do cadastro:

| Campo                                      | Quando é obrigatório     | Guardado em `donors` como                            |
| ------------------------------------------ | ------------------------ | ---------------------------------------------------- |
| `guardianName`, `guardianConsent` (`true`) | menos de 18 anos         | `guardianName` (cifrado), `guardianConsentDeclared`  |
| `donatedBefore60` (sim/não)                | 60 anos ou mais          | `donatedBefore60`                                    |
| `regularDonor` (sim/não)                   | 70 anos ou mais          | `regularDonorDeclared`                               |
| `lastDonationDate`                         | opcional, qualquer idade | `lastDonationAt`; entra em `donationDates` se for dos últimos 12 meses |

Se faltar um campo obrigatório, o eligibility recusa o cadastro com 400 (`Donor.draft`); o auth
desfaz o usuário recém-criado e devolve a mensagem. A data da última doação não pode ser futura nem
anterior ao nascimento, e passa a contar para o intervalo mínimo e o limite anual.

Depois do cadastro, o doador corrige as declarações em `PATCH /donors/:id` (cartão "Minhas
declarações" no perfil). Confirmar o termo exige o nome do responsável, e deixar de se declarar
doador regular desfaz a avaliação médica registrada.

No mesmo endpoint, o doador corrige os dados do perfil (CPF, nascimento, sexo, peso, tipo sanguíneo,
telefone). Trocar a data de nascimento desfaz a avaliação médica (ela foi feita para a idade
anterior); as declarações que a nova idade exigir são cobradas na próxima avaliação de
elegibilidade. A última doação também pode ser informada (ex.: doou em outro lugar), mas só avança:
uma data anterior à já registrada encurtaria o intervalo mínimo entre doações, então essa correção
fica com o hemocentro.

### Avaliação médica (70 anos ou mais)

O admin registra a avaliação favorável do serviço de hemoterapia com
`POST /donors/:id/medical-clearance` e a desfaz com `DELETE /donors/:id/medical-clearance`. Os dois
são auditados (`audit_accesses`, ação `UPDATE`). O registro só é aceito para doadores que já têm 70
anos e declararam ser doadores regulares; ele guarda a data (`medicalClearanceAt`) e o admin
(`medicalClearanceBy`).

Como a regra exige que o doador esteja saudável, a avaliação vale 12 meses
(`MEDICAL_CLEARANCE_VALIDITY_MONTHS`): uma avaliação de 15/09/2026 vale até 14/09/2027, inclusive.
Depois disso, o motor volta a dar `MEDICAL_CLEARANCE_REQUIRED` e o admin registra uma nova avaliação.
O perfil do doador traz o último dia de validade (`medicalClearanceValidUntil`).

### Avisos

Uma avaliação apta pode trazer avisos (`notices`, gravados em `eligibility_assessments`). Hoje há
um só: `BRING_GUARDIAN_CONSENT`, para menores de 18. Uma avaliação inapta não traz avisos.

O agendamento confirmado guarda os avisos da sua avaliação (`appointments.eligibilityNotices`), e
eles aparecem em três lugares:

- na tela de agendamento do doador;
- nos e-mails de pedido de confirmação e de lembrete;
- na lista de agendamentos do admin ("Menor de 18 - conferir termo"), para a unidade conferir o termo
  assinado no check-in.

## Cálculo de idade

Idade em anos completos na data de referência (hoje), considerando se o doador já fez aniversário
neste ano civil (`calculateAge`, em `backend/services/eligibility/src/domain/services/dates.ts`), no
calendário de `America/Sao_Paulo` - não é um cálculo ingênuo de diferença de anos. Quem nasceu em
29/02 faz aniversário em 01/03 nos anos não bissextos.

## Inaptidão temporária ativa

Um período de `temporary_unfitness` está "ativo hoje" quando:

```
startDate <= hoje
  AND (
    (actualEndDate IS NOT NULL AND hoje < actualEndDate)          -- encerrado: vale até a véspera
    OR (actualEndDate IS NULL AND (
          expectedEndDate IS NULL                                  -- período em aberto
          OR hoje <= expectedEndDate))                             -- ainda dentro do previsto
  )
```

Ou seja: um período sem nenhuma data de fim é considerado ativo indefinidamente, até o admin
encerrá-lo (`PATCH /donors/:id/unfitness/:unfitnessId/end`, que grava a `actualEndDate`);
`actualEndDate`, quando presente, sempre tem prioridade sobre `expectedEndDate` para decidir se o
período já acabou. O último dia previsto é inaptidão: o doador volta a poder doar no dia seguinte.
Já a `actualEndDate` é o dia em que o doador foi liberado: encerrar hoje libera hoje mesmo.

Validações das datas:

- no registro, `expectedEndDate` não pode ser anterior a `startDate`;
- o encerramento antecipado só vale para um período ainda em vigor (não um que já terminou na data
  prevista), e a `actualEndDate` fica entre o início do período e hoje: ela não pode ser futura nem
  estender a inaptidão além da data prevista.

Com mais de um período em vigor, o motor usa o que mais restringe: um em aberto, senão o que termina
por último.

## Resultado final e próxima data de elegibilidade

```
resultado =
  se motivos inclui PERMANENT_UNFIT        → PERMANENT_UNFIT
  senão se motivos.length > 0                 → TEMPORARY_UNFIT
  senão                                        → ELIGIBLE

nextEligibilityDate =
  se resultado == TEMPORARY_UNFIT, há datas candidatas e todo motivo tem data → a MAIOR delas
  senão                                                                        → null
```

Datas candidatas (o primeiro dia em que o motivo deixa de valer):

| Motivo                         | Data candidata                                         |
| ------------------------------ | ------------------------------------------------------ |
| `AGE_BELOW_MIN`                | aniversário de 16 anos                                 |
| `ACTIVE_TEMPORARY_UNFITNESS`   | dia seguinte ao fim (real ou previsto) do período      |
| `MIN_INTERVAL_NOT_FULFILLED`   | última doação + 2 meses (homens) ou 3 meses (mulheres) |
| `MAX_ANNUAL_DONATIONS_REACHED` | dia em que a doação mais antiga sai da janela de 12 meses |

"A maior das datas candidatas" (não a menor) é intencional: se o doador está inapto por dois
motivos com datas diferentes (ex.: inaptidão temporária termina em 10 dias, mas o intervalo
mínimo entre doações só termina em 30 dias), a data em que ele realmente volta a ficar apto é a
**mais distante** das duas - a menor daria uma data em que ele ainda estaria inapto pelo outro
motivo.

`nextEligibilityDate` fica `null` quando o resultado é `PERMANENT_UNFIT` (não há "próxima
data" possível sem uma intervenção manual do admin) ou quando **algum** motivo não tem data prevista
para acabar: peso, consentimento do responsável, doação antes dos 60, idade acima do limite,
avaliação médica e inaptidão temporária em aberto dependem de uma ação do doador ou do admin. Nesse
caso, informar a data de outro motivo prometeria ao doador (no perfil e no e-mail de agradecimento)
uma data em que ele ainda estaria inapto.

## O que fica de fora (trabalho futuro)

- Conferência do termo de consentimento do responsável: o sistema registra a declaração, avisa o
  doador e sinaliza o agendamento para a unidade, mas o termo assinado é conferido no hemocentro, no
  dia da doação.
- Comprovação do histórico de doações declarado (doação antes dos 60, doador regular, última
  doação): o sistema confia na declaração do doador.
- Diferenciação entre doação de sangue total e por aférese (a modelagem atual não distingue tipos
  de doação).
- Lista completa de condições clínicas/comportamentais e seus prazos específicos de inaptidão
  (a Portaria 5/2017 detalha dezenas de casos - o campo `reason` é texto livre para o admin
  registrar qualquer um deles, mas o sistema não valida contra uma tabela de referência).
