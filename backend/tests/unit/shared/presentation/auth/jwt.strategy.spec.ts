import type { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@shared/domain/enums';
import type { TokenRevocation } from '@shared/application/auth';
import { JwtStrategy } from '@shared/presentation/auth/jwt.strategy';

describe('JwtStrategy', () => {
  const config = { getOrThrow: () => 'segredo' } as unknown as ConfigService;
  const actor = { sub: 'u1', email: 'a@x.com', role: Role.ADMIN };
  const revocation = (seconds: number | null): TokenRevocation => ({
    revokeUser: jest.fn(),
    revokedAtSeconds: jest.fn().mockResolvedValue(seconds),
  });

  it('aceita o token quando não há revogação', async () => {
    const strategy = new JwtStrategy(config, revocation(null));
    await expect(strategy.validate({ ...actor, iat: 1000 })).resolves.toMatchObject(actor);
  });

  it('recusa token emitido antes da revogação e aceita os emitidos depois', async () => {
    const strategy = new JwtStrategy(config, revocation(1000));
    await expect(strategy.validate({ ...actor, iat: 999 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(strategy.validate({ ...actor, iat: 1000 })).resolves.toMatchObject(actor);
  });

  it('sem o módulo de revogação, só valida a assinatura e a validade', async () => {
    const strategy = new JwtStrategy(config, null);
    await expect(strategy.validate({ ...actor, iat: 1 })).resolves.toMatchObject(actor);
  });
});
