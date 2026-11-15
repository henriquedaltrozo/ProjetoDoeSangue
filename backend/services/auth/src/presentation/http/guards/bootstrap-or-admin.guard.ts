import { Actor } from '@shared/application/auth';
import { Role } from '@shared/domain/enums';
import { createHash, timingSafeEqual } from 'crypto';
import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ExistsAdminUseCase } from '../../../application/use-cases/exists-admin.use-case';

/**
 * Guard da rota POST /auth/admin.
 *
 * Problema que resolve: normalmente essa rota exige um admin já autenticado
 * (JwtAuthGuard + RolesGuard(ADMIN)), mas isso torna impossível criar o
 * *primeiro* admin do sistema via API - ninguém teria um JWT de admin ainda.
 *
 * Solução: enquanto ExistsAdminUseCase for false, libera a rota para
 * quem apresentar o token de instalação (header `x-setup-token` igual à
 * variável ADMIN_SETUP_TOKEN) - sem ele, qualquer pessoa que alcançasse o
 * sistema antes do dono poderia se tornar admin. Sem ADMIN_SETUP_TOKEN
 * configurado, o bootstrap fica fechado. Assim que o primeiro admin
 * existir, passa a exigir JWT válido + role admin, igual a qualquer outra
 * rota administrativa - fecha a janela de bootstrap automaticamente.
 */
@Injectable()
export class BootstrapOrAdminGuard extends AuthGuard('jwt') {
  constructor(
    private readonly existsAdmin: ExistsAdminUseCase,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const existsAdmin = await this.existsAdmin.execute();
    if (!existsAdmin) {
      this.validateInstallationToken(context);
      return true;
    }

    const isAuthenticated = (await super.canActivate(context)) as boolean;
    if (!isAuthenticated) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as Actor;
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Usuário não tem permissão para acessar este recurso.');
    }
    return true;
  }

  private validateInstallationToken(context: ExecutionContext): void {
    const expected = this.config.get<string>('ADMIN_SETUP_TOKEN');
    if (!expected) {
      throw new ForbiddenException(
        'Criação do primeiro admin desabilitada: defina ADMIN_SETUP_TOKEN no auth-service.',
      );
    }
    const header = context.switchToHttp().getRequest().headers['x-setup-token'];
    const received = Array.isArray(header) ? header[0] : header;
    // Compara hashes de tamanho fixo em tempo constante.
    const hash = (v: string) => createHash('sha256').update(v).digest();
    if (!received || !timingSafeEqual(hash(received), hash(expected))) {
      throw new ForbiddenException('Token de instalação inválido.');
    }
  }
}
