import { Role } from '@shared/domain/enums';
import { ConflictError, NotFoundError } from '@src/application/errors/application.errors';
import { Environment, createEnvironment, seedUser } from '@test/support/fakes';
import { DeactivateAdminUseCase } from '@src/application/use-cases/deactivate-admin.use-case';
import { ListAdminsUseCase } from '@src/application/use-cases/list-admins.use-case';
import { ReactivateAdminUseCase } from '@src/application/use-cases/reactivate-admin.use-case';
import { RefreshToken } from '@src/domain/entities/refresh-token';

describe('gestão de admins', () => {
  let env: Environment;
  beforeEach(() => {
    env = createEnvironment();
  });

  describe('ListAdminsUseCase', () => {
    it('retorna somente usuários com role ADMIN, do mais antigo ao mais novo', async () => {
      await seedUser(env, { id: 'donor', email: 'd@x.com' });
      await seedUser(env, {
        id: 'a2',
        email: 'a2@x.com',
        role: Role.ADMIN,
        createdAt: new Date('2026-02-01'),
      });
      await seedUser(env, {
        id: 'a1',
        email: 'a1@x.com',
        role: Role.ADMIN,
        createdAt: new Date('2026-01-01'),
      });

      const admins = await new ListAdminsUseCase(env.users).execute();

      expect(admins.map((a) => a.id)).toEqual(['a1', 'a2']);
    });
  });

  describe('DeactivateAdminUseCase', () => {
    let useCase: DeactivateAdminUseCase;
    beforeEach(() => {
      useCase = new DeactivateAdminUseCase(env.unitOfWork, env.revocation, env.clock);
    });

    it('impede desativar a própria conta', async () => {
      await expect(useCase.execute('admin-1', 'admin-1')).rejects.toThrow(
        new ConflictError('Você não pode desativar sua própria conta de admin.'),
      );
    });

    it('lança NotFoundError quando o admin não existe', async () => {
      await expect(useCase.execute('not-exists', 'admin-1')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('lança NotFoundError para usuário que não é admin', async () => {
      const donor = await seedUser(env);
      await expect(useCase.execute(donor.id, 'admin-1')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('impede desativar o único admin ativo', async () => {
      const admin = await seedUser(env, { id: 'admin-2', role: Role.ADMIN });
      await expect(useCase.execute(admin.id, 'admin-1')).rejects.toThrow(
        new ConflictError('Não é possível desativar o único admin ativo.'),
      );
      expect((await env.users.findById('admin-2'))?.active).toBe(true);
    });

    it('desativa quando há outros admins ativos', async () => {
      await seedUser(env, { id: 'admin-1', email: 'a1@x.com', role: Role.ADMIN });
      await seedUser(env, { id: 'admin-2', email: 'a2@x.com', role: Role.ADMIN });

      const out = await useCase.execute('admin-2', 'admin-1');

      expect(out.active).toBe(false);
      expect((await env.users.findById('admin-2'))?.active).toBe(false);
    });

    it('encerra as sessões do admin desativado (não voltam a valer se ele for reativado)', async () => {
      await seedUser(env, { id: 'admin-1', email: 'a1@x.com', role: Role.ADMIN });
      await seedUser(env, { id: 'admin-2', email: 'a2@x.com', role: Role.ADMIN });
      await env.refreshTokens.save(
        new RefreshToken({
          id: 't-admin-2',
          userId: 'admin-2',
          tokenHash: 'h',
          expiresAt: new Date(2999, 1, 1),
          revokedAt: null,
          createdAt: env.clock.now(),
        }),
      );

      await useCase.execute('admin-2', 'admin-1');

      expect(env.refreshTokens.items.has('t-admin-2')).toBe(false);
    });

    it('desativar um admin que já está inativo é idempotente', async () => {
      await seedUser(env, { id: 'admin-2', role: Role.ADMIN, active: false });
      const out = await useCase.execute('admin-2', 'admin-1');
      expect(out.active).toBe(false);
    });
  });

  describe('ReactivateAdminUseCase', () => {
    it('lança NotFoundError quando o admin não existe', async () => {
      await expect(new ReactivateAdminUseCase(env.users).execute('x')).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('reativa um admin desativado', async () => {
      await seedUser(env, { id: 'admin-2', role: Role.ADMIN, active: false });
      const out = await new ReactivateAdminUseCase(env.users).execute('admin-2');
      expect(out.active).toBe(true);
      expect((await env.users.findById('admin-2'))?.active).toBe(true);
    });
  });
});
