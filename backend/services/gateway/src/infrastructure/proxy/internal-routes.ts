import type { NextFunction, Request, Response } from 'express';

interface InternalRoute {
  /** Método HTTP; ausente = qualquer método. */
  method?: string;
  pattern: RegExp;
}

/**
 * Endpoints de uso exclusivo entre serviços (protegidos por `x-internal-api-key` no próprio serviço).
 * Os serviços se chamam direto, sem passar pelo gateway; por isso o gateway nunca os repassa ao exterior
 * (defesa em profundidade: mesmo que a chave vaze, a rota não é alcançável pela porta pública).
 * O Express casa rotas sem diferenciar maiúsculas/minúsculas, então os padrões também não diferenciam.
 */
const INTERNAL_ROUTES: InternalRoute[] = [
  { method: 'POST', pattern: /^\/donors$/i },
  { pattern: /^\/donors\/internal(\/|$)/i },
  { method: 'POST', pattern: /^\/donors\/[^/]+\/anonymize$/i },
  { method: 'POST', pattern: /^\/donors\/[^/]+\/donations\/complete$/i },
  { pattern: /^\/eligibility\/internal(\/|$)/i },
  { pattern: /^\/appointments\/internal(\/|$)/i },
];

/** Normaliza o path como o Express o veria: sem barras duplicadas nem barra final. */
function normalize(path: string): string {
  const cleaned = path.replace(/\/{2,}/g, '/');
  return cleaned.length > 1 ? cleaned.replace(/\/+$/, '') : cleaned;
}

export function isInternalRoute(method: string, path: string): boolean {
  const normalized = normalize(path);
  return INTERNAL_ROUTES.some(
    (route) =>
      (!route.method || route.method === method.toUpperCase()) && route.pattern.test(normalized),
  );
}

/** Middleware: responde 404 para rotas internas, como se elas não existissem no gateway. */
export function blockInternalRoutes(req: Request, res: Response, next: NextFunction): void {
  if (isInternalRoute(req.method, req.path)) {
    res.status(404).json({ statusCode: 404, message: 'Not Found', error: 'Not Found' });
    return;
  }
  next();
}
