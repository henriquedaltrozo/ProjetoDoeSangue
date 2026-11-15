import { Role } from '@shared/domain/enums';
import { ConflictError } from '@src/application/errors/application.errors';
import { Environment, createEnvironment, seedUser } from '@test/support/fakes';
import { RegisterAdminUseCase } from '@src/application/use-cases/register-admin.use-case';

describe('RegisterAdminUseCase', () => {
  let env: Environment;
  let useCase: RegisterAdminUseCase;
  const input = { email: 'admin@example.com', password: 'password1234', name: 'Admin' };

  beforeEach(() => {
    env = createEnvironment();
    useCase = new RegisterAdminUseCase(env.users, env.hasher, env.clock, env.ids);
  });

  it('cria um usuário com role ADMIN, ativo, e devolve só os dados públicos', async () => {
    const out = await useCase.execute(input);

    expect(out).toEqual({
      id: 'id-1',
      email: input.email,
      name: input.name,
      role: Role.ADMIN,
      donorId: null,
      active: true,
      // Admin criado por outro admin (ou na instalação): o e-mail já conta como confirmado.
      emailVerified: true,
      pendingEmail: null,
    });
    expect(env.users.items.get('id-1')?.passwordHash).toBe('hash:password1234');
  });

  it('rejeita e-mail já cadastrado', async () => {
    await seedUser(env, { email: input.email });
    await expect(useCase.execute(input)).rejects.toBeInstanceOf(ConflictError);
  });
});
