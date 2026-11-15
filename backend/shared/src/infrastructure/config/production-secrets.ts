/**
 * Em produção, os segredos precisam ser de verdade: nada de valores de exemplo ("troque-este-...")
 * nem curtos demais. Sem isso, um deploy esquecido com os padrões do docker-compose ou do
 * .env.example subiria com um JWT_SECRET público, e qualquer um poderia forjar tokens de admin.
 *
 * O docker-compose local liga ALLOW_INSECURE_DEFAULT_SECRETS=true para a demonstração funcionar sem
 * configurar nada; nesse caso o serviço sobe, mas avisa no log. Nunca usar essa liberação num
 * ambiente real.
 */
const PLACEHOLDER = /troque|change.?me|exemplo|example/i;
const MIN_SECRET_LENGTH = 32;

/** Os segredos que, se presentes, são verificados (cada serviço usa só alguns). */
const SECRETS = ['JWT_SECRET', 'INTERNAL_API_KEY'] as const;

/** Chave de 32 bytes em hex (64 caracteres) ou base64, como `getKey` em encrypted-column.transformer. */
const isProperEncryptionKey = (key: string) =>
  /^[0-9a-fA-F]{64}$/.test(key) ||
  (/^[A-Za-z0-9+/]{43}=$/.test(key) && Buffer.from(key, 'base64').length === 32);

/** Lista os problemas (só nomes de variáveis, nunca os valores). Vazia = tudo certo. */
export function findInsecureSecrets(env: Record<string, unknown>): string[] {
  const problems: string[] = [];
  for (const name of SECRETS) {
    const value = env[name];
    if (typeof value !== 'string') continue;
    if (PLACEHOLDER.test(value)) problems.push(`${name} ainda é o valor de exemplo`);
    else if (value.length < MIN_SECRET_LENGTH) {
      problems.push(`${name} tem menos de ${MIN_SECRET_LENGTH} caracteres`);
    }
  }
  const key = env.DATA_ENCRYPTION_KEY;
  if (typeof key === 'string' && !isProperEncryptionKey(key)) {
    problems.push('DATA_ENCRYPTION_KEY não é uma chave de 32 bytes (64 hex ou base64)');
  }
  return problems;
}

/**
 * Recusa subir em produção com segredos inseguros, a menos que a liberação explícita esteja ligada
 * (aí só avisa). Fora de produção não faz nada.
 */
export function assertProductionSecrets(
  env: Record<string, unknown>,
  warn: (message: string) => void = console.warn,
): void {
  if (env.NODE_ENV !== 'production') return;
  const problems = findInsecureSecrets(env);
  if (problems.length === 0) return;

  const detail = problems.join('; ');
  if (env.ALLOW_INSECURE_DEFAULT_SECRETS === 'true') {
    warn(
      `AVISO: segredos inseguros aceitos por ALLOW_INSECURE_DEFAULT_SECRETS=true (${detail}). ` +
        'Use só para rodar localmente.',
    );
    return;
  }
  throw new Error(
    `Segredos inseguros para produção: ${detail}. Gere valores reais (ver .env.example) ` +
      'ou, só para rodar localmente, defina ALLOW_INSECURE_DEFAULT_SECRETS=true.',
  );
}
