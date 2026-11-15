import { PROXY_ROUTES } from '@src/infrastructure/proxy/proxy-routes';

describe('PROXY_ROUTES', () => {
  it('não repete prefixos e todo prefixo começa com barra', () => {
    const prefixes = PROXY_ROUTES.map((r) => r.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    for (const p of prefixes) expect(p.startsWith('/')).toBe(true);
  });

  it('roteia cada prefixo para o serviço dono da rota', () => {
    const target = (prefix: string) => PROXY_ROUTES.find((r) => r.prefix === prefix)?.targetEnvVar;
    expect(target('/auth')).toBe('AUTH_SERVICE_URL');
    expect(target('/donors')).toBe('ELIGIBILITY_SERVICE_URL');
    expect(target('/appointments')).toBe('SCHEDULING_SERVICE_URL');
    expect(target('/outbox')).toBe('SCHEDULING_SERVICE_URL');
    expect(target('/notifications')).toBe('NOTIFICATION_SERVICE_URL');
  });
});
