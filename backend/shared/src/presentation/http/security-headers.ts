import helmet from 'helmet';

const helmetApi = helmet();
// O Swagger UI (/docs) usa scripts e estilos inline, que a CSP padrão do helmet bloquearia.
const helmetDocs = helmet({ contentSecurityPolicy: false });

/** Cabeçalhos de segurança (helmet) para todos os serviços; relaxa só a CSP em /docs. */
export function securityHeadersMiddleware(
  req: { path?: string; url?: string },
  res: unknown,
  next: (err?: unknown) => void,
): void {
  const path = req.path ?? req.url ?? '';
  const handler = path.startsWith('/docs') ? helmetDocs : helmetApi;
  (handler as unknown as (...a: unknown[]) => void)(req, res, next);
}
