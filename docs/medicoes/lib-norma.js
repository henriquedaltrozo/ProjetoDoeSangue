// Apoio de h1-cobertura.js, h2-correcao.js e contagem-testes.js: executa o Jest de um pacote e lê o resultado.
// Não depende de banco, Redis nem dos serviços em execução.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..', '..');
const BACKEND = path.join(RAIZ, 'backend');
const ELEGIBILIDADE = path.join(BACKEND, 'services', 'eligibility');
const ARQUIVO_NORMA = 'assess-eligibility.norma.spec';
const ENUM_MOTIVOS = path.join(BACKEND, 'shared', 'src', 'domain', 'enums', 'ineligibility-reason.enum.ts');

/**
 * Executa o Jest em `cwd` e devolve o JSON de resultado (`--json`). O Jest sai com código diferente de
 * zero quando um teste falha, mas o JSON é gravado do mesmo jeito: quem chama decide o que fazer.
 */
function executarJest(cwd, argsExtras = []) {
  const saida = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jest-')), 'resultado.json');
  const r = spawnSync('pnpm', ['exec', 'jest', '--silent', '--json', `--outputFile=${saida}`, ...argsExtras], {
    cwd,
    shell: true, // pnpm é pnpm.cmd no Windows
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
  });
  if (!fs.existsSync(saida)) {
    throw new Error(`O Jest não gerou resultado em ${cwd}.\n${r.stdout || ''}\n${r.stderr || ''}`);
  }
  return JSON.parse(fs.readFileSync(saida, 'utf8'));
}

/** Casos da suíte da norma: [{ grupo, titulo, status }] na ordem em que o Jest os executa. */
function casosDaNorma(jsonJest) {
  const arquivo = jsonJest.testResults.find((t) => t.name.includes(ARQUIVO_NORMA));
  if (!arquivo) throw new Error(`Arquivo ${ARQUIVO_NORMA} não encontrado nos resultados do Jest.`);
  return arquivo.assertionResults.map((a) => ({
    grupo: a.ancestorTitles.join(' / ').replace(/^Norma - /, ''),
    titulo: a.title,
    status: a.status, // passed | failed
  }));
}

/** Executa só a suíte da norma, ou reaproveita o JSON do Jest indicado em --jest-json=<arquivo>. */
function carregarCasosDaNorma(argv) {
  const reuso = argv.find((a) => a.startsWith('--jest-json='));
  const json = reuso
    ? JSON.parse(fs.readFileSync(reuso.slice('--jest-json='.length), 'utf8'))
    : executarJest(ELEGIBILIDADE, ['--testPathPattern', ARQUIVO_NORMA]);
  return casosDaNorma(json);
}

/** Códigos declarados no enum de motivos de recusa do motor (IneligibilityReason). */
function motivosDoMotor() {
  const texto = fs.readFileSync(ENUM_MOTIVOS, 'utf8');
  return new Set([...texto.matchAll(/^\s*([A-Z_]+)\s*=\s*'/gm)].map((m) => m[1]));
}

function ler(nome) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, nome), 'utf8'));
}

function gravar(nome, dados) {
  fs.writeFileSync(path.join(__dirname, nome), `${JSON.stringify(dados, null, 2)}\n`);
}

/** Percentual com uma casa decimal (ex.: 83.3). */
const pct = (parte, total) => (total === 0 ? 0 : Math.round((parte / total) * 1000) / 10);

module.exports = {
  RAIZ,
  BACKEND,
  ELEGIBILIDADE,
  ARQUIVO_NORMA,
  executarJest,
  casosDaNorma,
  carregarCasosDaNorma,
  motivosDoMotor,
  ler,
  gravar,
  pct,
};
