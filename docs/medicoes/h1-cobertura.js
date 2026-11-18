// H1: cobertura da norma, C = implementados / requisitos x 100 (parciais não contam), limiar de 80%.
// Confere, para cada requisito de rastreabilidade.json, se o motivo existe no motor e se cada teste
// citado existe na suíte da norma e passa. Uso (na raiz do repositório):
//   node docs/medicoes/h1-cobertura.js [--md] [--jest-json=<arquivo>]
// --md grava docs/09-rastreabilidade-norma.md. Resultado em docs/medicoes/resultados-h1.json.
// Sai com código 1 se C < limiar ou se a rastreabilidade estiver inconsistente com o código.
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, carregarCasosDaNorma, motivosDoMotor, ler, gravar, pct } = require('./lib-norma');

const SITUACAO = { implementado: 'implementado', parcial: 'parcial (declaração e aviso)', nao_implementado: 'não implementado' };

function main() {
  const argv = process.argv.slice(2);
  const dados = ler('rastreabilidade.json');
  const casos = carregarCasosDaNorma(argv);
  const porTitulo = new Map(casos.map((c) => [c.titulo, c]));
  const motivos = motivosDoMotor();
  const problemas = [];

  const confere = (req) => {
    if (req.situacao !== 'nao_implementado') {
      if (!req.motivo || !motivos.has(req.motivo)) problemas.push(`${req.id}: motivo "${req.motivo}" não existe no motor`);
      if (req.testes.length === 0) problemas.push(`${req.id}: situação "${req.situacao}" sem nenhum teste`);
    } else if (req.motivo) {
      problemas.push(`${req.id}: marcado como não implementado, mas cita o motivo ${req.motivo}`);
    }
    for (const t of req.testes) {
      const caso = porTitulo.get(t);
      if (!caso) problemas.push(`${req.id}: teste não encontrado na suíte da norma: "${t}"`);
      else if (caso.status !== 'passed') problemas.push(`${req.id}: teste não passou: "${t}"`);
    }
  };
  dados.requisitos.forEach(confere);
  dados.excecoes.filter((e) => e.testes).forEach((e) => confere({ id: e.dispositivo, ...e }));

  const total = dados.requisitos.length;
  const implementados = dados.requisitos.filter((r) => r.situacao === 'implementado').length;
  const parciais = dados.requisitos.filter((r) => r.situacao === 'parcial').length;
  const cobertura = pct(implementados, total);

  // Sensibilidade ao universo: se as exceções por avaliação médica também contassem como requisitos.
  const totalComExcecoes = total + dados.excecoes.length;
  const implComExcecoes = implementados + dados.excecoes.filter((e) => e.situacao === 'implementado').length;

  const resultado = {
    hipotese: 'H1',
    executadoEm: new Date().toISOString(),
    norma: dados.norma,
    requisitos: total,
    implementados,
    parciais,
    naoImplementados: total - implementados - parciais,
    coberturaPercentual: cobertura,
    limiarPercentual: dados.limiarCobertura,
    sustentada: cobertura >= dados.limiarCobertura && problemas.length === 0,
    sensibilidade: {
      comExcecoesPorAvaliacaoMedica: { implementados: implComExcecoes, total: totalComExcecoes, percentual: pct(implComExcecoes, totalComExcecoes) },
    },
    itens: dados.requisitos.map((r) => ({ id: r.id, situacao: r.situacao, motivo: r.motivo, testes: r.testes.length })),
    problemas,
  };
  gravar('resultados-h1.json', resultado);

  console.log('Id   Situação                      Motivo no motor                       Testes');
  for (const r of dados.requisitos) {
    console.log(`${r.id.padEnd(4)} ${SITUACAO[r.situacao].padEnd(29)} ${String(r.motivo ?? '---').padEnd(36)} ${r.testes.length}`);
  }
  console.log(`\nC = ${implementados}/${total} = ${cobertura}% (limiar ${dados.limiarCobertura}%; ${parciais} parcial, fora da contagem)`);
  console.log(`Com as ${dados.excecoes.length} exceções por avaliação médica no universo: ${implComExcecoes}/${totalComExcecoes} = ${pct(implComExcecoes, totalComExcecoes)}%`);
  if (problemas.length) console.log(`\nINCONSISTÊNCIAS (${problemas.length}):\n- ${problemas.join('\n- ')}`);
  console.log(`\nH1: ${resultado.sustentada ? 'SUSTENTADA' : 'NÃO SUSTENTADA'}`);

  if (argv.includes('--md')) {
    const arquivo = path.join(RAIZ, 'docs', '09-rastreabilidade-norma.md');
    fs.writeFileSync(arquivo, markdown(dados, resultado));
    console.log(`Gravado: ${path.relative(RAIZ, arquivo)}`);
  }
  process.exit(resultado.sustentada ? 0 : 1);
}

function markdown(dados, r) {
  const linhas = dados.requisitos.map(
    (q) => `| ${q.id} | ${q.criterio} | ${q.dispositivo} | ${q.motivo ? `\`${q.motivo}\`` : '---'} | ${q.testes.length} | ${SITUACAO[q.situacao]} |`,
  );
  const excecoes = dados.excecoes.map(
    (e) => `| ${e.dispositivo} | ${e.descricao} | ${e.situacao === 'implementado' ? `implementada (${e.testes.length} testes)` : 'não implementada'} |`,
  );
  return `# 09. Rastreabilidade entre a norma, as regras do motor e os testes

Gerado por \`node docs/medicoes/h1-cobertura.js --md\` a partir de \`docs/medicoes/rastreabilidade.json\`. Não edite à mão:
altere o JSON e gere de novo. O script confere que cada motivo existe no motor
(\`backend/shared/src/domain/enums/ineligibility-reason.enum.ts\`) e que cada teste citado existe e passa na suíte
\`assess-eligibility.norma.spec.ts\`.

Norma: ${dados.norma}.

Universo de H1: critérios que podem ser decididos com dados informados pelo doador ou mantidos pelo serviço (arts. 38
a 40 e inaptidões registradas na triagem). Um caso de teste pode exercitar mais de um requisito, então a soma da coluna
de testes não é o total da suíte (${new Set(dados.requisitos.flatMap((q) => q.testes)).size} casos distintos citados).

| Id. | Critério | Dispositivo | Motivo no motor | Testes | Situação |
|---|---|---|---|---|---|
${linhas.join('\n')}

**Cobertura (H1):** ${r.implementados}/${r.requisitos} = ${r.coberturaPercentual}% (limiar de ${r.limiarPercentual}%). Os requisitos parciais não entram na contagem.

## Exceções que dependem de avaliação médica (fora do universo)

| Dispositivo | Exceção | Situação |
|---|---|---|
${excecoes.join('\n')}

Se as três exceções entrassem no universo, a proporção seria ${r.sensibilidade.comExcecoesPorAvaliacaoMedica.implementados}/${r.sensibilidade.comExcecoesPorAvaliacaoMedica.total} (${r.sensibilidade.comExcecoesPorAvaliacaoMedica.percentual}%).
`;
}

main();
