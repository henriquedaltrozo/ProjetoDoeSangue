import { UserOutput, toUserOutput } from '../dto/user.output';
import { NotFoundError } from '../errors/application.errors';
import { USER_REPOSITORY, UserRepository } from '../ports/user.repository';

/** [admin] Reativa um admin previamente desativado. */
export class ReactivateAdminUseCase {
  static readonly inject = [USER_REPOSITORY] as const;

  constructor(private readonly users: UserRepository) {}

  async execute(id: string): Promise<UserOutput> {
    const admin = await this.users.findAdminById(id);
    if (!admin) {
      throw new NotFoundError('Admin não encontrado.');
    }
    admin.reactivate();
    await this.users.save(admin);
    return toUserOutput(admin);
  }
}
