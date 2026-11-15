import { UnauthorizedException } from '@nestjs/common';
import { InternalApiKeyGuard } from '@src/presentation/auth/internal-api-key.guard';

function contextWith(header: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-internal-api-key': header } }) }),
  } as never;
}

describe('InternalApiKeyGuard', () => {
  const guard = new InternalApiKeyGuard({ getOrThrow: () => 'chave-interna-123' } as never);

  it('aceita a chave correta', () => {
    expect(guard.canActivate(contextWith('chave-interna-123'))).toBe(true);
  });

  it.each([undefined, '', 'chave-interna-124', 'curta', ['chave-interna-123']])(
    'rejeita %p',
    (header) => {
      expect(() => guard.canActivate(contextWith(header))).toThrow(UnauthorizedException);
    },
  );
});
