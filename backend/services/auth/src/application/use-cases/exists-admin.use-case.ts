import { USER_REPOSITORY, UserRepository } from '../ports/user.repository';

/** Usado pelo BootstrapOrAdminGuard para liberar a criação do 1º admin sem autenticação. */
export class ExistsAdminUseCase {
  static readonly inject = [USER_REPOSITORY] as const;

  constructor(private readonly users: UserRepository) {}

  async execute(): Promise<boolean> {
    return (await this.users.countAdmins()) > 0;
  }
}
