import { CLOCK, Clock } from '@shared/application/ports';
import { User } from '../../domain/entities/user';
import { UserOutput, toUserOutput } from '../dto/user.output';
import { ConflictError } from '../errors/application.errors';
import { ID_GENERATOR, IdGenerator } from '../ports/id-generator.port';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher.port';
import { USER_REPOSITORY, UserRepository } from '../ports/user.repository';

export interface RegisterAdminInput {
  email: string;
  password: string;
  name: string;
}

export class RegisterAdminUseCase {
  static readonly inject = [USER_REPOSITORY, PASSWORD_HASHER, CLOCK, ID_GENERATOR] as const;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RegisterAdminInput): Promise<UserOutput> {
    if (await this.users.findByEmail(input.email)) {
      throw new ConflictError('E-mail já cadastrado.');
    }
    const admin = User.newAdmin({
      id: this.ids.newId(),
      email: input.email,
      passwordHash: await this.hasher.hash(input.password),
      name: input.name,
      createdAt: this.clock.now(),
    });
    await this.users.save(admin);
    return toUserOutput(admin);
  }
}
