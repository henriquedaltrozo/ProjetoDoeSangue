// Garante que o package.json de cada pacote (serviços e `shared`) declara exatamente as bibliotecas que o
// código dele usa.
//
// Por que é preciso: os serviços não instalam o `shared` como pacote; compilam o código-fonte dele
// (aliases `@shared/...`). Assim, uma biblioteca usada por um arquivo do `shared` tem de estar
// declarada no `shared/package.json` (para os testes do shared) E no package.json de cada serviço que
// importa aquele arquivo (é o node_modules do serviço que a fornece no build e em produção). Nada no
// pnpm ou no TypeScript avisa quando essas listas saem de sincronia; este script avisa.
//
// Como funciona, para cada pacote:
//  1. percorre o grafo de imports a partir do src/ do pacote, seguindo imports relativos e os aliases
//     (`@shared/...`), e anota as bibliotecas externas alcançadas;
//  2. soma as bibliotecas exigidas em tempo de execução por outras (ver RUNTIME_REQUIRES);
//  3. compara com "dependencies": falta alguma? sobra alguma?
//  4. faz o mesmo percurso nos testes do pacote (tests/{unit,integration,support}/<pacote>) e exige que
//     cada biblioteca usada ali esteja em "dependencies" ou "devDependencies".
// Um pacote coberto só por `@types/<nome>` conta como uso de tipos (ex.: `express`, que chega em tempo
// de execução pelo @nestjs/platform-express).
import { builtinModules } from 'node:module';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const importRe = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
const builtins = new Set(builtinModules);

/**
 * Bibliotecas que não são importadas pelo código, mas que outra biblioteca exige instaladas para
 * funcionar (dependências peer ou drivers carregados dinamicamente).
 */
const RUNTIME_REQUIRES = {
  '@nestjs/common': ['reflect-metadata', 'rxjs'],
  '@nestjs/core': ['@nestjs/platform-express'],
  '@nestjs/swagger': ['swagger-ui-express'],
  '@nestjs/axios': ['axios', 'rxjs'],
  '@nestjs/passport': ['passport'],
  '@nestjs/bullmq': ['bullmq'],
  typeorm: ['pg'],
};

const posix = (p) => p.split(sep).join('/');

const packages = [
  ...readdirSync(join(root, 'services'))
    .filter((n) => statSync(join(root, 'services', n)).isDirectory())
    .map((n) => ({ name: n, dir: join(root, 'services', n) })),
  { name: 'shared', dir: join(root, 'shared') },
];

function listTs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist') return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listTs(full) : full.endsWith('.ts') ? [full] : [];
  });
}

/** Resolve um caminho sem extensão para o arquivo .ts correspondente (arquivo ou index.ts). */
function toFile(base) {
  for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Os mesmos aliases dos tsconfig.json/jest.config.js (iguais em todos os pacotes). */
function resolveAlias(specifier, pkg) {
  const sharedSrc = join(root, 'shared', 'src');
  const rules = [
    [/^@shared\/contracts$/, () => join(sharedSrc, 'contracts')],
    [/^@shared\/bootstrap$/, () => join(sharedSrc, 'bootstrap')],
    [/^@shared\/testing\/(.*)$/, (m) => join(root, 'tests', 'support', 'shared', m[1])],
    [/^@shared\/(domain|application|infrastructure|presentation)\/(.*)$/, (m) => join(sharedSrc, m[1], m[2])],
    [/^@src\/(.*)$/, (m) => join(pkg.dir, 'src', m[1])],
    [/^@test\/support\/(.*)$/, (m) => join(root, 'tests', 'support', pkg.name, m[1])],
  ];
  for (const [re, target] of rules) {
    const m = specifier.match(re);
    if (m) return target(m);
  }
  return null;
}

/** Nome do pacote npm de um import ("@nestjs/common/x" -> "@nestjs/common", "rxjs/operators" -> "rxjs"). */
const packageName = (specifier) =>
  specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];

/** Percorre o grafo de imports a partir de `entries` e devolve as bibliotecas externas usadas. */
function externalImports(entries, pkg, problems) {
  const used = new Map(); // biblioteca -> primeiro arquivo que a usa (para a mensagem de erro)
  const seen = new Set();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(importRe)) {
      if (specifier.startsWith('node:') || builtins.has(specifier)) continue;
      const local = specifier.startsWith('.')
        ? resolve(dirname(file), specifier)
        : resolveAlias(specifier, pkg);
      if (local) {
        const target = toFile(local);
        if (target) queue.push(target);
        else problems.push(`${posix(relative(root, file))}: não foi possível resolver ${specifier}`);
        continue;
      }
      const name = packageName(specifier);
      if (!used.has(name)) used.set(name, posix(relative(root, file)));
    }
  }
  return used;
}

function withRuntimeRequirements(used) {
  const required = new Set(used.keys());
  for (const name of [...required]) for (const extra of RUNTIME_REQUIRES[name] ?? []) required.add(extra);
  return required;
}

const problems = [];
for (const pkg of packages) {
  const manifest = JSON.parse(readFileSync(join(pkg.dir, 'package.json'), 'utf8'));
  const deps = new Set(Object.keys(manifest.dependencies ?? {}));
  const devDeps = new Set(Object.keys(manifest.devDependencies ?? {}));
  const declared = (name) => deps.has(name) || devDeps.has(name) || devDeps.has(`@types/${name}`);
  const label = posix(relative(root, join(pkg.dir, 'package.json')));

  // Produção: "dependencies" == bibliotecas alcançadas a partir de src/ (+ exigidas em runtime).
  const srcUsed = externalImports(listTs(join(pkg.dir, 'src')), pkg, problems);
  const required = withRuntimeRequirements(srcUsed);
  for (const name of [...required].sort()) {
    if (deps.has(name)) continue;
    if (devDeps.has(`@types/${name}`)) continue; // só tipos (ex.: express)
    const where = srcUsed.get(name) ?? 'exigida em runtime por outra biblioteca';
    problems.push(`${label}: falta "${name}" em dependencies (usada em ${where})`);
  }
  for (const name of [...deps].sort()) {
    if (!required.has(name)) problems.push(`${label}: "${name}" está em dependencies, mas o código não a usa`);
  }

  // Testes: tudo o que usam precisa estar declarado (dependencies ou devDependencies).
  const testEntries = ['unit', 'integration', 'support'].flatMap((kind) =>
    listTs(join(root, 'tests', kind, pkg.name)),
  );
  const testUsed = externalImports(testEntries, pkg, problems);
  for (const [name, where] of testUsed) {
    if (!declared(name)) problems.push(`${label}: falta "${name}" em devDependencies (usada em ${where})`);
  }

  // devDependencies que nem os testes nem os tipos do código usam.
  const usedAnywhere = new Set([...required, ...testUsed.keys()]);
  for (const name of [...devDeps].sort()) {
    const typesOf = name.startsWith('@types/') ? name.slice('@types/'.length).replace(/^(.+)__/, '@$1/') : null;
    if (usedAnywhere.has(name) || (typesOf && usedAnywhere.has(typesOf))) continue;
    problems.push(`${label}: "${name}" está em devDependencies, mas nem o código nem os testes a usam`);
  }
}

if (problems.length) {
  console.error(`Dependências fora de sincronia:\n${problems.map((p) => ` - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('Deps OK: cada pacote declara exatamente as bibliotecas que o seu código (e o do shared que ele usa) importa.');
