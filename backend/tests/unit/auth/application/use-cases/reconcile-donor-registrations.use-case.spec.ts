import { Role } from '@shared/domain/enums';
import { Environment, createEnvironment, seedUser } from '@test/support/fakes';
import {
  REGISTRATION_GRACE_MS,
  ReconcileDonorRegistrationsUseCase,
} from '@src/application/use-cases/reconcile-donor-registrations.use-case';

describe('ReconcileDonorRegistrationsUseCase', () => {
  let env: Environment;
  let useCase: ReconcileDonorRegistrationsUseCase;

  /** Faz o relógio passar do período de carência. */
  const afterGrace = () => env.clock.advance(REGISTRATION_GRACE_MS + 1_000);

  beforeEach(() => {
    env = createEnvironment();
    useCase = new ReconcileDonorRegistrationsUseCase(
      env.users,
      env.eligibility,
      env.clock,
      env.logger,
      env.unitOfWork,
      env.verificationNotices,
    );
  });

  it('não mexe em cadastros recentes (ainda podem estar em andamento)', async () => {
    await seedUser(env);

    expect(await useCase.execute()).toEqual({ linked: 0, removed: 0, skipped: 0 });
    expect(env.users.items.size).toBe(1);
  });

  it('vincula o doador quando ele existe no eligibility-service', async () => {
    const user = await seedUser(env);
    env.eligibility.existing.set(user.id, 'donor-9');
    afterGrace();

    expect(await useCase.execute()).toEqual({ linked: 1, removed: 0, skipped: 0 });
    expect((await env.users.findById(user.id))?.donorId).toBe('donor-9');
    // Concluído pela reconciliação, o cadastro também recebe as boas-vindas (com o link de confirmação).
    expect(env.accountNotices.payloads()).toEqual([
      expect.objectContaining({
        type: 'welcome',
        userId: user.id,
        donorId: 'donor-9',
        verificationUrl: expect.stringContaining('/verify-email?token='),
      }),
    ]);
  });

  it('remove o usuário quando comprovadamente não há doador', async () => {
    const user = await seedUser(env);
    afterGrace();

    expect(await useCase.execute()).toEqual({ linked: 0, removed: 1, skipped: 0 });
    expect(await env.users.findById(user.id)).toBeNull();
  });

  it('se a consulta falha, mantém o usuário e tenta de novo na próxima rodada', async () => {
    const user = await seedUser(env);
    env.eligibility.lookupFailure = new Error('eligibility fora do ar');
    afterGrace();

    expect(await useCase.execute()).toEqual({ linked: 0, removed: 0, skipped: 1 });
    expect(await env.users.findById(user.id)).not.toBeNull();
    expect(env.logger.notices).toHaveLength(1);

    env.eligibility.lookupFailure = null;
    env.eligibility.existing.set(user.id, 'donor-3');
    expect(await useCase.execute()).toEqual({ linked: 1, removed: 0, skipped: 0 });
  });

  it('ignora admins, doadores já vinculados e contas inativas', async () => {
    await seedUser(env, { id: 'admin-1', email: 'a@x.com', role: Role.ADMIN });
    await seedUser(env, { id: 'linked-1', email: 'l@x.com', donorId: 'donor-1' });
    await seedUser(env, { id: 'inactive-1', email: 'i@x.com', active: false });
    afterGrace();

    expect(await useCase.execute()).toEqual({ linked: 0, removed: 0, skipped: 0 });
    expect(env.users.items.size).toBe(3);
  });
});
