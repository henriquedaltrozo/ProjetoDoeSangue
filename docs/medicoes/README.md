# Medições das hipóteses H1 a H5 (TCC)

Scripts e resultados da avaliação descrita nos capítulos 4 e 6 e nos apêndices do TCC. Cada hipótese tem um
critério de aceitação e um instrumento aqui. Os resultados brutos (`resultados-*.json`) ficam versionados.

| Hipótese | Métrica (critério) | Instrumento | Resultado | Precisa dos serviços? |
|---|---|---|---|---|
| H1 | cobertura da norma C = implementados / requisitos, ≥ 80% | `h1-cobertura.js` + `rastreabilidade.json` | `resultados-h1.json`, `../09-rastreabilidade-norma.md` | não |
| H2 | 100% de classificações corretas nos casos da norma | `h2-correcao.js` | `resultados-h2.json`, `casos-norma.md` | não |
| H3 | menos etapas manuais antes da coleta e verificações de H1 antes da ida | `h3-etapas.js` + `processo-h3.json` | `resultados-h3.json` | não |
| H4 | p95 da confirmação ≤ 1000 ms; entrega ≤ 10 s; sem perda; capacidade respeitada | `carga-h4.js`, `capacidade.js`, `smtp-captura.js` | `resultados-h4-*.json`, `resultados-capacidade.json` | sim |
| H5 | itens da lista de verificação da LGPD atendidos e demonstrados | `lgpd-h5.js` | `resultados-h5.json` | sim |
| Todas | situação de cada hipótese segundo os critérios | `sintese.js` | `resultados-sintese.json` | não (lê os resultados) |

Os resultados de H4 e H5 foram medidos em 15/11/2026 e o de capacidade em 17/11/2026, em Ubuntu 24.04, 2 núcleos, 8 GB,
Node.js 22, PostgreSQL 16 e Redis 7, com os serviços de elegibilidade, agendamento e notificação em modo de teste
(`env-teste.sh`), cada um com banco próprio, recriado vazio antes de cada configuração. Gateway e auth não participam: os
tokens JWT são emitidos pelos scripts com o `JWT_SECRET` de teste. Os valores de segredo dos scripts são só de teste.

## H1 a H3 (sem serviços, na raiz do repositório)

```bash
cd backend && pnpm install --frozen-lockfile && cd ..
node docs/medicoes/h1-cobertura.js --md   # confere motivos e testes de rastreabilidade.json; grava ../09-rastreabilidade-norma.md
node docs/medicoes/h2-correcao.js --suite --md   # executa a suíte da norma 3 vezes e a suíte completa de elegibilidade
node docs/medicoes/h3-etapas.js
```

Ou, dentro de `backend`, `pnpm medir:norma` (os três de uma vez) e `pnpm medir:sintese`. Os três scripts saem com código 1
quando a hipótese não é sustentada ou quando `rastreabilidade.json` não bate com o código (motivo inexistente no motor,
teste que não existe ou não passa). Para mudar a tabela de H1, altere `rastreabilidade.json` e gere de novo; um caso de
teste pode servir a mais de um requisito. `processo-h3.json` é uma inferência a partir de documentos públicos (Hemoba e
Fiocruz), não uma medição: não houve entrevista nem visita a um hemocentro.

## H4 e H5 (com os serviços em execução)

| Arquivo | O que faz |
|---|---|
| `smtp-captura.js` | Servidor SMTP de captura (porta 2525); grava o instante de cada mensagem. Precisa de `npm i smtp-server mailparser`. |
| `carga-h4.js` | H4: 1 execução sequencial + `RUNS` simultâneas de `N` agendamentos; mede confirmação (HTTP 201) e entrega das 2 mensagens por agendamento. |
| `capacidade.js` | H4: 20 requisições simultâneas para uma unidade de 5 vagas; grava o resultado em `resultados-capacidade.json`. |
| `lgpd-h5.js` | H5: 29 verificações da lista da LGPD (inclui a leitura do banco para provar que os identificadores estão cifrados). |

```bash
cd docs/medicoes
. ./env-teste.sh                       # variáveis (use MAIL_RATE_PER_SECOND=50 para o limite elevado)
node smtp-captura.js mails.jsonl &     # captura
# suba eligibility, scheduling e notification (node dist/services/<s>/src/main.js)
MAILS=$PWD/mails.jsonl OUT=resultados-h4-limite-padrao.json N=50 RUNS=5 node carga-h4.js
node capacidade.js resultados-capacidade.json
node lgpd-h5.js resultados-h5.json
node sintese.js                        # situação de H1 a H5
```

O `lgpd-h5.js` consulta o banco com `psql` (usuário `eligibility_svc`). A síntese considera H5 parcialmente sustentada
enquanto algum item confirmar uma limitação declarada (hoje nenhum item o faz).

Última medição: 18/11/2026, com os identificadores cifrados. H4: p95 da confirmação de 340 a 592 ms (limite padrão) e de 340 a 551 ms (limite elevado); entrega de até 21,2 s no padrão e 9,7 s no elevado; 600/600 mensagens em cada configuração; capacidade: 5 aceitas e 15 recusadas. H5: 29 de 29 itens com o resultado esperado (H5 sustentada).
