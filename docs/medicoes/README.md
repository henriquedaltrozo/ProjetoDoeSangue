# Medições de H4 e H5 (TCC)

Scripts e resultados brutos usados no Capítulo 6 e no Apêndice B do TCC.

- `env.sh`: variáveis de ambiente (modo de teste, segredos de teste, bancos, portas).
- `smtp-sink.js`: servidor SMTP de captura (grava um JSON por mensagem recebida).
- `load.js`: H4 — 50 agendamentos simultâneos (execução 0 sequencial + 5 simultâneas), mede confirmação e entrega.
- `over.js`: teste de integridade da capacidade (20 requisições para uma unidade de capacidade 5).
- `h5.js`: 16 verificações da lista de verificação da LGPD.
- `h4-results.json`, `h5-results.json`: resultados obtidos em 30/10/2026.

Os scripts esperam os serviços eligibility (3002), scheduling (3003) e notification (3004), PostgreSQL, Redis e o sink SMTP em execução.
Ajuste os caminhos (`MAILS`, `OUT`) conforme o seu ambiente. Dados 100% fictícios.
