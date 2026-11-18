// H3: etapas manuais anteriores à coleta. Conta as etapas manuais do processo atual e do processo com o
// sistema (processo-h3.json) e confere a segunda condição: toda verificação de H1 implementada fica em uma
// etapa decidida no agendamento, isto é, antes da ida do doador ao hemocentro. Uso:
//   node docs/medicoes/h3-etapas.js
// Resultado em docs/medicoes/resultados-h3.json. Usa a situação dos requisitos registrada em
// rastreabilidade.json. É uma inferência a partir de documentos públicos, não uma medição de tempo.
// Sai com código 1 se H3 não for sustentada.
const { ler, gravar } = require('./lib-norma');

function main() {
  const processo = ler('processo-h3.json');
  const rastreabilidade = ler('rastreabilidade.json');
  const manuaisAtual = processo.etapas.filter((e) => e.atual === 'manual').length;
  const manuaisSistema = processo.etapas.filter((e) => e.sistema === 'manual').length;

  // Requisitos de H1 implementados (contam para a segunda condição); os parciais só registram declaração.
  const implementados = rastreabilidade.requisitos.filter((r) => r.situacao === 'implementado').map((r) => r.id);
  const noAgendamento = new Set(processo.etapas.flatMap((e) => e.h1 ?? []));
  const semEtapa = implementados.filter((id) => !noAgendamento.has(id));
  const desconhecidos = [...noAgendamento].filter((id) => !rastreabilidade.requisitos.some((r) => r.id === id));
  const automatizadas = processo.etapas.filter((e) => e.atual === 'manual' && e.sistema === 'automatica').map((e) => e.id);

  const reduz = manuaisSistema < manuaisAtual;
  const antesDaIda = semEtapa.length === 0 && desconhecidos.length === 0;
  const resultado = {
    hipotese: 'H3',
    executadoEm: new Date().toISOString(),
    etapas: processo.etapas.length,
    manuaisProcessoAtual: manuaisAtual,
    manuaisComSistema: manuaisSistema,
    etapasAutomatizadas: automatizadas,
    requisitosH1AntesDaIda: implementados.filter((id) => noAgendamento.has(id)),
    requisitosH1SemEtapa: semEtapa,
    referenciasInvalidas: desconhecidos,
    menosEtapasManuais: reduz,
    verificacoesH1AntesDaIda: antesDaIda,
    sustentada: reduz && antesDaIda,
    natureza: 'inferência a partir de documentos públicos (sem entrevista nem visita)',
  };
  gravar('resultados-h3.json', resultado);

  console.log('Id    Atual    Com o sistema');
  for (const e of processo.etapas) console.log(`${e.id.padEnd(5)} ${e.atual.padEnd(8)} ${e.sistema}`);
  console.log(`\nEtapas manuais: ${manuaisAtual} (atual) -> ${manuaisSistema} (com o sistema); automatizadas: ${automatizadas.join(', ')}`);
  console.log(`Verificações de H1 antes da ida ao hemocentro: ${antesDaIda ? 'todas' : `faltam ${semEtapa.join(', ')}`}`);
  console.log(`H3: ${resultado.sustentada ? 'SUSTENTADA' : 'NÃO SUSTENTADA'}`);
  process.exit(resultado.sustentada ? 0 : 1);
}

main();
