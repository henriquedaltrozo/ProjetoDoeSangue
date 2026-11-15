// Garante as fronteiras de arquitetura do backend (layout: um pacote por serviço + `shared`).
//
//   services/<serviço>/src/{domain,application,infrastructure,presentation}   código do serviço
//   services/<serviço>/src/*.ts                                               raiz de composição (main.ts, módulos)
//   tests/{unit,integration,support}/<serviço>                                testes do serviço
//   shared/src/...  e  tests/{unit,integration,support}/shared       mesmo formato, para o código comum
//
// Regras:
//  1. isolamento: um serviço só importa de si mesmo e de `shared`; `shared` nunca importa de um serviço;
//     nenhum import relativo cruza a fronteira do pacote (o código comum entra pelo alias `@shared/...`);
//  2. regra de dependência da Clean Architecture em todo pacote (serviços e shared):
//     domain -> (nada), application -> domain, infrastructure -> application/domain,
//     presentation -> application/domain (nunca infrastructure);
//     domain e application também não usam módulos do Node nem pacotes de terceiros (exceto a lista abaixo);
//  3. imports relativos não saem do backend e aliases desconhecidos são rejeitados;
//  4. os barrels `@shared/contracts` e `@shared/bootstrap` são reservados à raiz de composição
//     (arquivos soltos em src/) e aos testes: reexportam tudo e esconderiam dependências entre camadas;
//  5. a presentation só alcança o domain para enums e errors (para traduzi-los); entidades, value objects
//     e regras ficam atrás da application, cujos casos de uso devolvem DTOs de saída;
//  6. o código de produção (src/) nunca importa dos testes (`@src`, `@test` e `@shared/testing` são só dos testes).
//  As regras 2 e 5 não valem para a raiz de composição nem para os testes.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LAYERS = ['domain', 'application', 'infrastructure', 'presentation'];
const importRe = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
const violations = [];

const ALLOWED = {
  domain: [/^@shared\/domain\//],
  application: [/^@shared\/domain\//, /^@shared\/application\//],
};
const FORBIDDEN = {
  domain: ['application', 'infrastructure', 'presentation'],
  application: ['infrastructure', 'presentation'],
  infrastructure: ['presentation'],
  presentation: ['infrastructure'],
};

const packages = [
  ...(existsSync(join(root, 'services'))
    ? readdirSync(join(root, 'services')).filter((n) => statSync(join(root, 'services', n)).isDirectory())
    : []
  ).map((n) => ({ name: n, dir: join('services', n) })),
  { name: 'shared', dir: 'shared' },
];

/** Áreas de um pacote: o código (src) e as pastas de teste dele em tests/<tipo>/<pacote>. */
const areasOf = (pkg) => [
  { area: 'src', dir: join(pkg.dir, 'src') },
  ...['unit', 'integration', 'support'].map((kind) => ({ area: 'test', dir: join('tests', kind, pkg.name) })),
];

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist') return [];
    const fullPath = join(dir, name);
    return statSync(fullPath).isDirectory() ? listFiles(fullPath) : fullPath.endsWith('.ts') ? [fullPath] : [];
  });
}

const posix = (p) => p.split(sep).join('/');

/** Descobre pacote e área (src|test) de um caminho absoluto dentro do backend. */
function locate(absPath) {
  const rel = posix(relative(root, absPath));
  for (const pkg of packages) {
    for (const { area, dir } of areasOf(pkg)) {
      const prefix = `${posix(dir)}/`;
      if (rel.startsWith(prefix)) return { pkg, area, rest: rel.slice(prefix.length).split('/') };
    }
  }
  return null;
}

for (const pkg of packages) {
  for (const { area, dir } of areasOf(pkg)) {
    for (const file of listFiles(join(root, dir))) {
      const name = posix(relative(root, file));
      const inSrc = area === 'src';
      const rest = posix(relative(join(root, dir), file)).split('/');
      const layer = inSrc && LAYERS.includes(rest[0]) ? rest[0] : null; // null = raiz de composição / testes
      const isCompositionRoot = inSrc && layer === null;
      const source = readFileSync(file, 'utf8');

      for (const [, specifier] of source.matchAll(importRe)) {
        let target = null; // { pkgName, area, layer, path } do destino, quando é código do projeto
        if (specifier.startsWith('.')) {
          const abs = resolve(dirname(file), specifier);
          const loc = locate(abs);
          if (!abs.startsWith(root + sep) || !loc) {
            violations.push(`${name}: import fora do backend ou de pasta desconhecida (${specifier})`);
            continue;
          }
          if (loc.pkg.name !== pkg.name) {
            violations.push(`${name}: import relativo cruza a fronteira do pacote (${specifier}); use o alias @shared/...`);
            continue;
          }
          target = {
            pkgName: loc.pkg.name,
            area: loc.area,
            layer: loc.area === 'src' && LAYERS.includes(loc.rest[0]) ? loc.rest[0] : null,
            path: loc.rest.join('/'),
          };
        } else if (specifier.startsWith('@shared/')) {
          const parts = specifier.split('/');
          const head = parts[1];
          if (head === 'contracts' || head === 'bootstrap') {
            if (inSrc && !isCompositionRoot) {
              violations.push(
                `${name}: o barrel ${specifier} é reservado à raiz de composição e aos testes; importe da camada de origem (ex.: @shared/domain/enums)`,
              );
            }
            target = { pkgName: 'shared', area: 'src', layer: null, path: parts.slice(1).join('/') };
          } else if (head === 'testing') {
            if (inSrc) violations.push(`${name}: código de produção não pode importar ${specifier} (só testes)`);
            target = { pkgName: 'shared', area: 'test', layer: null, path: parts.slice(2).join('/') };
          } else if (LAYERS.includes(head)) {
            target = { pkgName: 'shared', area: 'src', layer: head, path: parts.slice(1).join('/') };
          } else {
            violations.push(`${name}: alias desconhecido ${specifier}`);
            continue;
          }
        } else if (/^@(src|test)\//.test(specifier)) {
          if (inSrc) {
            violations.push(`${name}: o alias ${specifier} é só dos testes; em src/ use imports relativos`);
            continue;
          }
          const isSrc = specifier.startsWith('@src/');
          const sub = specifier.replace(/^@(src|test)\//, '');
          target = {
            pkgName: pkg.name,
            area: isSrc ? 'src' : 'test',
            layer: isSrc && LAYERS.includes(sub.split('/')[0]) ? sub.split('/')[0] : null,
            path: sub,
          };
        } else if (/^@doesangue\//.test(specifier)) {
          violations.push(`${name}: alias antigo/desconhecido ${specifier}`);
          continue;
        }

        if (target) {
          // 1. isolamento entre pacotes
          if (target.pkgName !== pkg.name && target.pkgName !== 'shared') {
            violations.push(`${name}: o pacote ${pkg.name} não pode importar do pacote ${target.pkgName} (${specifier})`);
          }
          // 6. produção não importa de test/
          if (inSrc && target.area === 'test') {
            violations.push(`${name}: código de produção não pode importar dos testes (${specifier})`);
          }
          // 5. presentation -> domain só enums e errors
          if (layer === 'presentation' && target.area === 'src' && target.layer === 'domain') {
            if (!/^domain\/(enums|errors)(\/|$)/.test(target.path)) {
              violations.push(`${name}: a presentation só pode importar enums e errors do domain (${specifier})`);
            }
          }
          // 2. regra de dependência
          if (layer && target.area === 'src' && target.layer && FORBIDDEN[layer].includes(target.layer)) {
            violations.push(`${name}: a camada ${layer} não pode importar ${target.layer} (${specifier})`);
          }
        } else if (layer && ALLOWED[layer] && !ALLOWED[layer].some((re) => re.test(specifier))) {
          // pacote de terceiros / módulo do Node dentro de domain ou application
          violations.push(`${name}: a camada ${layer} não pode depender de ${specifier}`);
        }
      }
    }
  }
}

if (violations.length) {
  console.error(`Violações de fronteira:\n${violations.map((v) => ` - ${v}`).join('\n')}`);
  process.exit(1);
}
console.log('Boundaries OK: pacotes isolados por serviço e camadas da Clean Architecture respeitadas.');
