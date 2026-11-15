import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Actor } from '../../application/auth';

/** Uso: metodo(@CurrentUser() user: Actor) em rota protegida por JwtAuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): Actor => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
