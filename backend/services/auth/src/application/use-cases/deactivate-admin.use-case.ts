import {
  SelfDeactivationNotAllowedError,
  LastAdminActiveError,
} from '../../domain/errors/domain.errors';
import { verifyNotSelfDeactivation } from '../../domain/entities/user';
import { UserOutput, toUserOutput } from '../dto/user.output';
import { ConflictError, NotFoundError } from '../errors/application.errors';
import { CLOCK, type Clock } from '@shared/application/ports';
import { TOKEN_REVOCATION, type TokenRevocation } from '@shared/application/auth';
import { UNIT_OF_WORK, UnitOfWork } from '../ports/unit-of-work.port';

/**
 * [admin] Desativa outro admin (soft-delete via ativo=false, mesmo padrão
 * usado em unidades de coleta/campanhas). Bloqueado para a própria conta
 * (evita se auto-bloquear) e para o último admin ativo (evita ninguém
 * conseguir mais logar como admin). A contagem e a gravação acontecem numa transação com os admins
 * travados: dois admins desativando um ao outro ao mesmo tempo não deixam o sistema sem nenhum.
 */
export class DeactivateAdminUseCase {
  static readonly inject = [UNIT_OF_WORK, TOKEN_REVOCATION, CLOCK] as const;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly revocation: TokenRevocation,
    private readonly clock: Clock,
  ) {}

  async execute(id: string, requesterId: string): Promise<UserOutput> {
    try {
      verifyNotSelfDeactivation(id, requesterId);
      const output = await this.unitOfWork.run(async ({ users, refreshTokens }) => {
        await users.lockAdmins();
        const admin = await users.findAdminById(id);
        if (!admin) {
          throw new NotFoundError('Admin não encontrado.');
        }
        const active = admin.active ? await users.countAdminsActive() : 0;
        admin.deactivate(active);
        await users.save(admin);
        // Encerra as sessões: senão, ao ser reativado, os refresh tokens antigos voltariam a valer.
        await refreshTokens.deleteUserTokens(admin.id);
        return toUserOutput(admin);
      });
      // O admin desativado perde o acesso já, não só quando o token de acesso expirar.
      await this.revocation.revokeUser(id, this.clock.now());
      return output;
    } catch (err) {
      if (err instanceof SelfDeactivationNotAllowedError || err instanceof LastAdminActiveError) {
        throw new ConflictError(err.message);
      }
      throw err;
    }
  }
}
