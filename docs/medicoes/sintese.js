// Síntese de H1 a H5: lê os resultados-*.json desta pasta e aplica os critérios de aceitação do TCC
// (capítulo 4). Uma hipótese é "sustentada" quando todos os critérios são atendidos e "parcialmente
// sustentada" quando apenas parte deles é. Uso:
//   node docs/medicoes/sintese.js
// Antes, gere os resultados: h1-cobertura.js, h2-correcao.js e h3-etapas.js (não precisam dos serviços);
// carga-h4.js, capacidade.js e lgpd-h5.js (precisam dos serviços em execução, ver README.md).
// Resultado em docs/medicoes/resultados-sintese.json.
const fs = require('node:fs');
const path = require('node:path');
const { gravar } = require('./lib-norma');

// Critérios de H4 (capítulo 4): p95 da confirmação <= 1000 ms, entrega de todas as mensagens em até 10 s e
// nenhuma mensagem perdida ou duplicada, com 50 agendamentos simultâneos.
const LIMITE_P95_MS = 1000;
const LIMITE_ENTREGA_MS = 10_000;

const abrir = (nome) => {
  const arquivo = path.join(__dirname, nome);
  return fs.existsSync(arquivo) ? JSON.parse(fs.readFileSync(arquivo, 'utf8')) : null;
};

const status = (criterios) => {
  const atendidos = criterios.filter((c) => c.ok).length;
  if (atendidos === criterios.length) return 'sustentada';
  return atendidos > 0 ? 'parcialmente sustentada' : 'não sustentada';
};

const ms = (v) => `${v} ms`;
const s1 = (v) => `${(v / 1000).toFixed(1).replace('.', ',')} s`;

function h4PorConfiguracao(rotulo, execucoes) {
  const simultaneas = execucoes.filter((e) => e.mode === 'simultaneo');
  const p95 = Math.max(...simultaneas.map((e) => e.p95));
  const entrega = Math.max(...execucoes.map((e) => e.allMax));
  const perdas = execucoes.reduce((t, e) => t + (2 * e.n - e.totalMails + e.dup) + (e.n - e.created), 0);
  const duplicadas = execucoes.reduce((t, e) => t + e.dup, 0);
  return {
    configuracao: rotulo,
    execucoes: execucoes.length,
    p95ConfirmacaoMaxMs: p95,
    entregaMaxMs: entrega,
    mensagensEsperadas: execucoes.reduce((t, e) => t + 2 * e.n, 0),
    mensagensRecebidas: execucoes.reduce((t, e) => t + e.totalMails - e.dup, 0),
    duplicadas,
    perdidas: perdas,
    criterios: [
      { nome: `p95 da confirmação <= ${LIMITE_P95_MS} ms`, valor: ms(p95), ok: p95 <= LIMITE_P95_MS },
      { nome: `entrega de todas as mensagens em até ${LIMITE_ENTREGA_MS / 1000} s`, valor: s1(entrega), ok: entrega <= LIMITE_ENTREGA_MS },
      { nome: 'nenhuma mensagem perdida ou duplicada', valor: `${perdas} perdas, ${duplicadas} duplicadas`, ok: perdas === 0 && duplicadas === 0 },
    ],
  };
}

function main() {
  const h1 = abrir('resultados-h1.json');
  const h2 = abrir('resultados-h2.json');
  const h3 = abrir('resultados-h3.json');
  const padrao = abrir('resultados-h4-limite-padrao.json');
  const elevado = abrir('resultados-h4-limite-elevado.json');
  const capacidade = abrir('resultados-capacidade.json');
  const h5 = abrir('resultados-h5.json');
  const faltando = Object.entries({ h1, h2, h3, 'h4-limite-padrao': padrao, 'h4-limite-elevado': elevado, capacidade, h5 })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (faltando.length) {
    console.error(`Faltam resultados: ${faltando.join(', ')}. Veja o README.md desta pasta.`);
    process.exit(2);
  }

  const hipoteses = [];

  hipoteses.push({
    id: 'H1',
    criterios: [{ nome: `cobertura da norma >= ${h1.limiarPercentual}%`, valor: `${h1.implementados} de ${h1.requisitos} (${h1.coberturaPercentual}%); ${h1.parciais} parcial`, ok: h1.sustentada }],
  });
  hipoteses.push({
    id: 'H2',
    criterios: [{ nome: '100% de classificações corretas nos casos da norma', valor: `${h2.aprovados} de ${h2.casos} (${h2.execucoes.length} execuções)`, ok: h2.sustentada }],
  });
  hipoteses.push({
    id: 'H3',
    criterios: [
      { nome: 'menos etapas manuais antes da coleta', valor: `${h3.manuaisProcessoAtual} para ${h3.manuaisComSistema}`, ok: h3.menosEtapasManuais },
      { nome: 'verificações de H1 antes da ida ao hemocentro', valor: h3.verificacoesH1AntesDaIda ? 'todas' : `faltam ${h3.requisitosH1SemEtapa.join(', ')}`, ok: h3.verificacoesH1AntesDaIda },
    ],
  });

  // H4: o critério vale para a configuração padrão do serviço de notificação; a configuração com limite
  // elevado isola o custo do sistema do custo do limitador e é relatada à parte.
  const h4Padrao = h4PorConfiguracao('limite padrão (5 e-mails/s)', padrao);
  const h4Elevado = h4PorConfiguracao('limite elevado (50 e-mails/s)', elevado);
  const capacidadeOk = { nome: 'capacidade da unidade nunca excedida', valor: `${capacidade.aceitas} aceitas e ${capacidade.recusadas} recusadas para ${capacidade.capacidade} vagas`, ok: capacidade.sustentado };
  hipoteses.push({ id: 'H4', criterios: [...h4Padrao.criterios, capacidadeOk], detalhe: { padrao: h4Padrao, elevado: h4Elevado } });

  // H5: todos os itens aprovados e nenhuma limitação conhecida. Os itens que confirmam uma limitação
  // declarada passam no teste (a limitação existe, como relatado), mas impedem a conformidade plena.
  const limitacoes = h5.filter((i) => /limitação declarada/i.test(i.item));
  const reprovados = h5.filter((i) => !i.ok);
  hipoteses.push({
    id: 'H5',
    criterios: [
      { nome: 'todos os itens da lista de verificação executados com o resultado esperado', valor: `${h5.length - reprovados.length} de ${h5.length}`, ok: reprovados.length === 0 },
      { nome: 'nenhuma limitação conhecida confirmada pelos itens', valor: limitacoes.length ? limitacoes.map((l) => l.item).join('; ') : 'nenhuma', ok: limitacoes.length === 0 },
    ],
  });

  const saida = hipoteses.map((h) => ({ ...h, situacao: status(h.criterios) }));
  gravar('resultados-sintese.json', { geradoEm: new Date().toISOString(), hipoteses: saida });

  for (const h of saida) {
    console.log(`\n${h.id}: ${h.situacao.toUpperCase()}`);
    for (const c of h.criterios) console.log(`  [${c.ok ? 'x' : ' '}] ${c.nome}: ${c.valor}`);
  }
  const e = h4Elevado;
  console.log(`\nH4 com o limite elevado: p95 ${ms(e.p95ConfirmacaoMaxMs)}, entrega máxima ${s1(e.entregaMaxMs)}, ${e.perdidas} perdas -> ${status(e.criterios)}`);
}

main();
