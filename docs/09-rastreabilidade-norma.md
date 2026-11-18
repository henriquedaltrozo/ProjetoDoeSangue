# 09. Rastreabilidade entre a norma, as regras do motor e os testes

Gerado por `node docs/medicoes/h1-cobertura.js --md` a partir de `docs/medicoes/rastreabilidade.json`. Não edite à mão:
altere o JSON e gere de novo. O script confere que cada motivo existe no motor
(`backend/shared/src/domain/enums/ineligibility-reason.enum.ts`) e que cada teste citado existe e passa na suíte
`assess-eligibility.norma.spec.ts`.

Norma: Portaria GM/MS nº 11.685, de 2 de julho de 2026 (Anexo IV-B da Portaria de Consolidação GM/MS nº 5/2017).

Universo de H1: critérios que podem ser decididos com dados informados pelo doador ou mantidos pelo serviço (arts. 38
a 40 e inaptidões registradas na triagem). Um caso de teste pode exercitar mais de um requisito, então a soma da coluna
de testes não é o total da suíte (49 casos distintos citados).

| Id. | Critério | Dispositivo | Motivo no motor | Testes | Situação |
|---|---|---|---|---|---|
| R1 | Idade mínima de 16 anos | art. 39, caput | `AGE_BELOW_MIN` | 4 | implementado |
| R2 | Idade máxima de 69 anos, 11 meses e 29 dias | art. 39, caput | `AGE_ABOVE_MAX` | 4 | implementado |
| R3 | Primeira doação até 60 anos, 11 meses e 29 dias | art. 39, § 3º | `AGE_ABOVE_MAX_FIRST_DONATION` | 9 | implementado |
| R4 | Peso mínimo de 50 kg | art. 40, caput | `INSUFFICIENT_WEIGHT` | 6 | implementado |
| R5 | Intervalo mínimo de 2 meses (homens) | art. 38, § 1º | `MIN_INTERVAL_NOT_FULFILLED` | 6 | implementado |
| R6 | Intervalo mínimo de 3 meses (mulheres) | art. 38, § 1º | `MIN_INTERVAL_NOT_FULFILLED` | 4 | implementado |
| R7 | Máximo de 4 doações em 12 meses (homens) | art. 38, caput | `MAX_ANNUAL_DONATIONS_REACHED` | 5 | implementado |
| R8 | Máximo de 3 doações em 12 meses (mulheres) | art. 38, caput | `MAX_ANNUAL_DONATIONS_REACHED` | 3 | implementado |
| R9 | Inaptidão temporária registrada | triagem clínica | `ACTIVE_TEMPORARY_UNFITNESS` | 4 | implementado |
| R10 | Inaptidão definitiva registrada | triagem clínica | `PERMANENT_UNFIT` | 1 | implementado |
| R11 | Consentimento do responsável a cada doação (menores de 18 anos) | art. 39, §§ 1º e 2º | `GUARDIAN_CONSENT_REQUIRED` | 5 | parcial (declaração e aviso) |
| R12 | Perda de peso inexplicável superior a 10% em 3 meses | art. 40, § 2º | --- | 0 | não implementado |

**Cobertura (H1):** 10/12 = 83.3% (limiar de 80%). Os requisitos parciais não entram na contagem.

## Exceções que dependem de avaliação médica (fora do universo)

| Dispositivo | Exceção | Situação |
|---|---|---|
| art. 39, § 4º | idade fora da faixa por necessidade tecnicamente justificada | não implementada |
| art. 39, § 5º | continuidade da doação acima dos 70 anos por doador de repetição, com avaliação médica registrada pela equipe (válida por 12 meses) | implementada (5 testes) |
| art. 40, § 1º | aceitação de quem pesa menos de 50 kg, com ajuste do volume coletado | não implementada |

Se as três exceções entrassem no universo, a proporção seria 11/15 (73.3%).
