import { UserOutput, toUserOutput } from '../dto/user.output';
import { NotAuthenticatedError } from '../errors/application.errors';
import { USER_REPOSITORY, UserRepository } from '../ports/user.repository';

export class GetMeUseCase {
  static readonly inject = [USER_REPOSITORY] as const;

  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<UserOutput> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotAuthenticatedError();
    }
    return toUserOutput(user);
  }
}
