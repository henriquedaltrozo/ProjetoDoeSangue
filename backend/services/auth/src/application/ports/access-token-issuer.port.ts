import { Actor } from '@shared/application/auth';

export const ACCESS_TOKEN_ISSUER = Symbol('AccessTokenIssuer');

export interface AccessTokenIssuer {
  issue(payload: Actor): Promise<string>;
}
