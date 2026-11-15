import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TOKEN_REVOCATION } from '../application/auth';
import { RedisTokenRevocation } from '../infrastructure/auth';

/**
 * Liga a porta TOKEN_REVOCATION ao Redis. Global: o JwtStrategy (de qualquer serviço) consulta a
 * revogação, e o auth-service a grava. Importar uma vez no módulo raiz de cada serviço que valida JWT.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    RedisTokenRevocation,
    { provide: TOKEN_REVOCATION, useExisting: RedisTokenRevocation },
  ],
  exports: [TOKEN_REVOCATION],
})
export class TokenRevocationModule {}
