# Casos de teste derivados da norma

Gerado por `node docs/medicoes/h2-correcao.js --md` a partir de `assess-eligibility.norma.spec.ts`. Total: 57 casos.
Os valores-limite de cada critério numérico são testados no valor imediatamente abaixo, no igual e no imediatamente acima.

## idade (21/21)

- [x] idade mínima (com consentimento do responsável): 15 anos e 364 dias (um dia antes de completar 16)
- [x] idade mínima (com consentimento do responsável): exatamente 16 anos hoje
- [x] idade mínima (com consentimento do responsável): 16 anos e 1 dia
- [x] menores de 18: 16 anos, sem o responsável informado
- [x] menores de 18: 17 anos, responsável informado mas termo não confirmado
- [x] menores de 18: 18 anos hoje: não precisa mais do responsável
- [x] menor apto recebe o aviso para levar o termo assinado
- [x] idade máxima (doador de repetição, não regular): 69 anos, 11 meses e 29 dias (véspera dos 70 anos)
- [x] idade máxima (doador de repetição, não regular): exatamente 70 anos hoje
- [x] idade máxima (doador de repetição, não regular): 70 anos e 1 dia
- [x] 70 anos ou mais: doador regular sem avaliação médica
- [x] 70 anos ou mais: doador regular com avaliação médica favorável
- [x] 70 anos ou mais: avaliação de 12 meses atrás menos um dia: ainda vale hoje (último dia)
- [x] 70 anos ou mais: avaliação de exatamente 12 meses atrás: venceu
- [x] de 60 a 69 anos, sem doação antes dos 60: 59 anos, 11 meses e 29 dias (véspera dos 60 anos)
- [x] de 60 a 69 anos, sem doação antes dos 60: exatamente 60 anos hoje
- [x] de 60 a 69 anos, sem doação antes dos 60: 60 anos e 1 dia
- [x] de 60 a 69 anos pode doar quem declarou ter doado antes dos 60
- [x] de 60 a 69 anos pode doar quem tem doação registrada antes dos 60
- [x] uma doação conhecida feita depois dos 60 não prova doação antes dos 60
- [x] declarar que não doou antes dos 60 mantém a inaptidão

## idade, intervalo e limite anual no dia da doação agendada (7/7)

- [x] quem tem 69 anos hoje e agenda para depois dos 70 doaria com 70
- [x] quem tem 59 anos, nunca doou e agenda para depois dos 60 cai na regra dos 60
- [x] quem tem 15 anos e agenda para depois dos 16 pode doar
- [x] a avaliação médica precisa valer no dia da doação
- [x] um dia de doação no passado é ignorado (vale hoje)
- [x] intervalo mínimo: conta até o dia da doação, não até hoje
- [x] limite anual: a doação mais antiga sai da janela de 12 meses até o dia da doação

## peso mínimo (art. 40) (5/5)

- [x] peso de 49 kg
- [x] peso de 49.9 kg
- [x] peso de 50 kg
- [x] peso de 50.1 kg
- [x] peso de 70 kg

## intervalo mínimo entre doações (art. 38, §1º) (9/9)

- [x] M: um dia antes de completar 2 meses (última doação 2026-08-03)
- [x] M: exatamente 2 meses (última doação 2026-08-02)
- [x] M: mais de 2 meses (última doação 2026-08-01)
- [x] F: um dia antes de completar 3 meses (última doação 2026-07-03)
- [x] F: exatamente 3 meses (última doação 2026-07-02)
- [x] F: mais de 3 meses (última doação 2026-07-01)
- [x] F: homem liberado após 2 meses, mulher ainda não (mesma data) (última doação 2026-08-02)
- [x] M: doação hoje (última doação 2026-10-02)
- [x] meses curtos: doação em 31/12 libera o homem em 28/02

## máximo de doações em 12 meses (art. 38) (7/7)

- [x] M: 3 doações na janela
- [x] M: 4 doações na janela
- [x] M: 5 doações na janela (libera ao sair a segunda mais antiga)
- [x] F: 2 doações na janela
- [x] F: 3 doações na janela
- [x] a doação feita exatamente há 12 meses já saiu da janela; a de 12 meses menos um dia ainda conta
- [x] doador sem histórico detalhado conta a última doação (compatibilidade com dados anteriores)

## inaptidões e combinação de motivos (8/8)

- [x] inaptidão permanente encerra a avaliação
- [x] inaptidão temporária vale até a data prevista (inclusive): a próxima data é o dia seguinte
- [x] o encerramento antecipado decide a próxima data
- [x] inaptidão em aberto: não há próxima data
- [x] acumula motivos e informa como próxima data a mais distante
- [x] com um motivo sem prazo (peso abaixo do mínimo), não promete próxima data
- [x] com um motivo sem prazo (menor sem o termo), não promete próxima data
- [x] com um motivo sem prazo (60 anos sem doação antes), não promete próxima data
