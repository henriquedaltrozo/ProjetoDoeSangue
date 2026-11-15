import { CLOCK, Clock, LOGGER, LoggerPort } from '@shared/application/ports';
import { BLOCK_LOGIN_MINUTES } from '../../domain/entities/user';
import { AuthResult } from '../dto/user.output';
import { ManyAttemptsError, NotAuthenticatedError } from '../errors/application.errors';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher.port';
import { USER_REPOSITORY, UserRepository } from '../ports/user.repository';
import { SessionIssuer } from '../services/session-issuer';

export interface LoginInput {
  email: string;
  password: string;
}

export class LoginUseCase {
  static readonly inject = [
    USER_REPOSITORY,
    PASSWORD_HASHER,
    CLOCK,
    LOGGER,
    SessionIssuer,
  ] as const;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
    private readonly logger: LoggerPort,
    private readonly sessions: SessionIssuer,
  ) {}

  async execute(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);

    if (user?.isBlocked(this.clock.now())) {
      throw new ManyAttemptsError('Muitas tentativas de login. Tente novamente em alguns minutos.');
    }

    // Compara sempre (mesmo com e-mail inexistente) para o tempo de resposta não revelar
    // se a conta existe.
    const validPassword = await this.hasher.verify(input.password, user?.passwordHash ?? null);
    if (!user?.active || !validPassword) {
      if (user) {
        if (user.registerFailureLogin(this.clock.now())) {
          this.logger.warn(
            `Conta ${user.id} bloqueada por ${BLOCK_LOGIN_MINUTES} min após falhas de login.`,
          );
        }
        await this.users.saveLoginState(user);
      }
      throw new NotAuthenticatedError('Credenciais inválidas.');
    }

    user.registerSuccessfulLogin(this.clock.now());
    await this.users.saveLoginState(user);
    return this.sessions.issue(user);
  }
}
