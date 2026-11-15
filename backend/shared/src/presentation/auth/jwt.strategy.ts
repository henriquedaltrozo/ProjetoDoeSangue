import { Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Actor, TOKEN_REVOCATION, type TokenRevocation } from '../../application/auth';

/** Conteúdo do JWT de acesso: a identidade e o instante de emissão (segundos). */
type AccessTokenPayload = Actor & { iat?: number };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Optional() @Inject(TOKEN_REVOCATION) private readonly revocation: TokenRevocation | null,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * O retorno vira `request.user` em qualquer rota protegida por JwtAuthGuard. Um token emitido
   * antes da última revogação do usuário (conta desativada ou excluída, senha trocada) é recusado.
   */
  async validate(payload: AccessTokenPayload): Promise<Actor> {
    const revokedAt = await this.revocation?.revokedAtSeconds(payload.sub);
    if (revokedAt != null && (payload.iat ?? 0) < revokedAt) {
      throw new UnauthorizedException('Sessão encerrada. Entre novamente.');
    }
    return payload;
  }
}
