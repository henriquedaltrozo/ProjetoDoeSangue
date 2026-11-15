import { UserOutput, toUserOutput } from '../dto/user.output';
import { USER_REPOSITORY, UserRepository } from '../ports/user.repository';

/** [admin] Lista todos os usuários com papel admin, para a tela de gestão de admins. */
export class ListAdminsUseCase {
  static readonly inject = [USER_REPOSITORY] as const;

  constructor(private readonly users: UserRepository) {}

  async execute(): Promise<UserOutput[]> {
    const admins = await this.users.listAdmins();
    return admins.map(toUserOutput);
  }
}
