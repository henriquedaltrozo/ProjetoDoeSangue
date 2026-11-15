import { blockInternalRoutes, isInternalRoute } from '@src/infrastructure/proxy/internal-routes';

describe('rotas internas bloqueadas no gateway', () => {
  it.each([
    ['POST', '/donors'],
    ['POST', '/donors/'],
    ['GET', '/donors/internal/contacts'],
    ['GET', '/DONORS/Internal/contacts'],
    ['GET', '//donors//internal/contacts'],
    ['POST', '/donors/abc/anonymize'],
    ['POST', '/donors/abc/donations/complete'],
    ['POST', '/eligibility/internal/assess'],
    ['POST', '/appointments/internal/donors/d1/cancel-open'],
  ])('%s %s é bloqueada', (method, path) => {
    expect(isInternalRoute(method, path)).toBe(true);
  });

  it.each([
    ['GET', '/donors'],
    ['GET', '/donors/me'],
    ['GET', '/donors/abc'],
    ['PATCH', '/donors/abc'],
    ['GET', '/donors/abc/export'],
    ['POST', '/eligibility/assess'],
    ['POST', '/auth/login'],
    ['POST', '/appointments'],
  ])('%s %s passa para o serviço', (method, path) => {
    expect(isInternalRoute(method, path)).toBe(false);
  });

  it('responde 404 sem repassar a requisição', () => {
    const json = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ json }) };
    const next = jest.fn();
    blockInternalRoutes({ method: 'POST', path: '/donors' } as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('chama next para rotas públicas', () => {
    const next = jest.fn();
    blockInternalRoutes({ method: 'GET', path: '/donors/me' } as never, {} as never, next);
    expect(next).toHaveBeenCalled();
  });
});
