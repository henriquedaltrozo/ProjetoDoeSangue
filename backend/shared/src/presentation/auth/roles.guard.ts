import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../domain/enums';
import { Actor } from '../../application/auth';
import { ROLES_KEY } from './roles.decorator';

/**
 * Deve ser usado depois de JwtAuthGuard (que popula request.user). Sem
 * @Roles() no handler/controller, deixa passar qualquer usuário autenticado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user as Actor | undefined;
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Usuário não tem permissão para acessar este recurso.');
    }
    return true;
  }
}
