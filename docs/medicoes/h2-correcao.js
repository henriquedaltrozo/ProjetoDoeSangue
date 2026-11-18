// H2: correção do motor de regras, A = classificações corretas / casos x 100, que deve ser 100%.
// Executa a suíte da norma (assess-eligibility.norma.spec.ts), que traz os casos derivados dos arts. 38 a 40
// por análise de valor-limite, e conta os casos aprovados por grupo. Uso (na raiz do repositório):
//   node docs/medicoes/h2-correcao.js [--repeticoes=N] [--suite] [--md] [--jest-json=<arquivo>]
// --repeticoes=N executa a suíte N vezes (H2 exige 100% em todas as execuções; padrão 3).
// --suite também executa a suíte completa do serviço de elegibilidade e registra o total de testes.
// --md grava docs/medicoes/casos-norma.md (relação dos casos, usada no apêndice do TCC).
// Resultado em docs/medicoes/resultados-h2.json. Sai com código 1 se algum caso falhar.
const fs = require('node:fs');
const path = require('node:path');
const { ELEGIBILIDADE, ARQUIVO_NORMA, executarJest, carregarCasosDaNorma, gravar, pct } = require('./lib-norma');

// Os dois grupos de conferência no dia da doação agendada são apresentados juntos no TCC (tabela de casos).
const rotulo = (grupo) => (/no dia da doação agendada$/.test(grupo) ? 'idade, intervalo e limite anual no dia da doação agendada' : grupo);

function agrupar(casos) {
  const grupos = new Map();
  for (const c of casos) {
    const nome = rotulo(c.grupo);
    const g = grupos.get(nome) ?? { grupo: nome, casos: 0, aprovados: 0 };
    g.casos += 1;
    if (c.status === 'passed') g.aprovados += 1;
    grupos.set(nome, g);
  }
  return [...grupos.values()];
}

function main() {
  const argv = process.argv.slice(2);
  const rep = Number((argv.find((a) => a.startsWith('--repeticoes=')) ?? '--repeticoes=3').split('=')[1]);
  const reuso = argv.some((a) => a.startsWith('--jest-json='));
  const execucoes = [];
  let ultimos = [];
  for (let i = 1; i <= (reuso ? 1 : rep); i++) {
    ultimos = carregarCasosDaNorma(argv);
    const aprovados = ultimos.filter((c) => c.status === 'passed').length;
    execucoes.push({ execucao: i, casos: ultimos.length, aprovados, acertoPercentual: pct(aprovados, ultimos.length) });
    console.log(`Execução ${i}: ${aprovados}/${ultimos.length} casos classificados corretamente`);
  }

  const grupos = agrupar(ultimos);
  console.log('\nGrupo                                                                   Casos  Aprovados');
  for (const g of grupos) console.log(`${g.grupo.padEnd(72)} ${String(g.casos).padStart(4)}  ${String(g.aprovados).padStart(9)}`);

  const sustentada = execucoes.every((e) => e.casos > 0 && e.aprovados === e.casos);
  const resultado = {
    hipotese: 'H2',
    executadoEm: new Date().toISOString(),
    casos: ultimos.length,
    aprovados: ultimos.filter((c) => c.status === 'passed').length,
    acertoPercentual: pct(ultimos.filter((c) => c.status === 'passed').length, ultimos.length),
    execucoes,
    grupos,
    sustentada,
  };

  if (argv.includes('--suite')) {
    const j = executarJest(ELEGIBILIDADE);
    resultado.suiteElegibilidade = { arquivos: j.numTotalTestSuites, testes: j.numTotalTests, aprovados: j.numPassedTests, falhas: j.numFailedTests };
    console.log(`\nSuíte completa de elegibilidade: ${j.numPassedTests}/${j.numTotalTests} testes em ${j.numTotalTestSuites} arquivos`);
    if (j.numFailedTests > 0) resultado.sustentada = false;
  }

  gravar('resultados-h2.json', resultado);
  if (argv.includes('--md')) {
    const arquivo = path.join(__dirname, 'casos-norma.md');
    fs.writeFileSync(arquivo, markdown(grupos, ultimos));
    console.log(`Gravado: docs/medicoes/${path.basename(arquivo)}`);
  }
  console.log(`\nA = ${resultado.acertoPercentual}% em ${execucoes.length} execução(ões). H2: ${resultado.sustentada ? 'SUSTENTADA' : 'NÃO SUSTENTADA'}`);
  process.exit(resultado.sustentada ? 0 : 1);
}

function markdown(grupos, casos) {
  const corpo = grupos
    .map((g) => {
      const itens = casos.filter((c) => rotulo(c.grupo) === g.grupo).map((c) => `- [${c.status === 'passed' ? 'x' : ' '}] ${c.titulo}`);
      return `## ${g.grupo} (${g.aprovados}/${g.casos})\n\n${itens.join('\n')}`;
    })
    .join('\n\n');
  return `# Casos de teste derivados da norma

Gerado por \`node docs/medicoes/h2-correcao.js --md\` a partir de \`${ARQUIVO_NORMA}.ts\`. Total: ${casos.length} casos.
Os valores-limite de cada critério numérico são testados no valor imediatamente abaixo, no igual e no imediatamente acima.

${corpo}
`;
}

main();
