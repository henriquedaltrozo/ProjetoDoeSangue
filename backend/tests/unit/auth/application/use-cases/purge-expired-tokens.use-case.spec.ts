import { PasswordResetToken } from '@src/domain/entities/password-reset-token';
import { RefreshToken } from '@src/domain/entities/refresh-token';
import { PurgeExpiredTokensUseCase } from '@src/application/use-cases/purge-expired-tokens.use-case';
import { Environment, createEnvironment } from '@test/support/fakes';

describe('PurgeExpiredTokensUseCase', () => {
  let env: Environment;

  beforeEach(() => {
    env = createEnvironment();
  });

  const at = (minutes: number) => new Date(env.clock.now().getTime() + minutes * 60_000);

  it('apaga só os tokens vencidos (sessões e links de redefinição)', async () => {
    const refresh = (id: string, expiresAt: Date, revokedAt: Date | null = null) =>
      env.refreshTokens.save(
        new RefreshToken({
          id,
          userId: 'u-1',
          tokenHash: id,
          expiresAt,
          revokedAt,
          createdAt: at(-60),
        }),
      );
    await refresh('vencido', at(-1));
    await refresh('valido', at(60));
    // Revogado mas ainda na validade: fica, para denunciar o reuso de um token roubado.
    await refresh('revogado', at(60), at(-5));
    await env.resetTokens.save(
      new PasswordResetToken({
        id: 'r-velho',
        userId: 'u-1',
        tokenHash: 'r1',
        expiresAt: at(-1),
        usedAt: null,
        createdAt: at(-30),
      }),
    );
    await env.resetTokens.save(
      new PasswordResetToken({
        id: 'r-novo',
        userId: 'u-1',
        tokenHash: 'r2',
        expiresAt: at(10),
        usedAt: null,
        createdAt: at(-5),
      }),
    );

    const result = await new PurgeExpiredTokensUseCase(
      env.refreshTokens,
      env.resetTokens,
      env.clock,
    ).execute();

    expect(result).toEqual({ refreshTokens: 1, resetTokens: 1 });
    expect([...env.refreshTokens.items.keys()].sort()).toEqual(['revogado', 'valido']);
    expect([...env.resetTokens.items.keys()]).toEqual(['r-novo']);
  });
});
