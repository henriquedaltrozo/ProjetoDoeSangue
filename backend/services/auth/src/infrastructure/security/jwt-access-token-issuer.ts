import { Actor } from '@shared/application/auth';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenIssuer } from '../../application/ports/access-token-issuer.port';

@Injectable()
export class JwtAccessTokenIssuer implements AccessTokenIssuer {
  constructor(private readonly jwt: JwtService) {}

  issue(payload: Actor): Promise<string> {
    return this.jwt.signAsync(payload);
  }
}
