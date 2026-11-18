import { Role } from '@shared/domain/enums';
import { emailIndex } from '@shared/infrastructure/persistence';
import { EncryptUserIdentity1763100000000 } from '@src/infrastructure/persistence/migrations/1763100000000-encrypt-user-identity';
import {
  createTestDatabase,
  pendingSchemaChanges,
  TestDatabase,
} from '@shared/testing/test-database';
import { PasswordResetToken } from '@src/domain/entities/password-reset-token';
import { RefreshToken } from '@src/domain/entities/refresh-token';
import { User } from '@src/domain/entities/user';
import { MIGRATIONS } from '@src/infrastructure/persistence/migrations';
import { TypeOrmUnitOfWork } from '@src/infrastructure/persistence/typeorm-unit-of-work';
import { AccountNoticeOrmEntity } from '@src/infrastructure/persistence/orm-entities/account-notice.orm-entity';
import { AccountNoticeTypeOrmRepository } from '@src/infrastructure/persistence/repositories/account-notice.typeorm-repository';
import { NotificationJobType } from '@shared/domain/enums';
import { PasswordResetTokenOrmEntity } from '@src/infrastructure/persistence/orm-entities/password-reset-token.orm-entity';
import { RefreshTokenOrmEntity } from '@src/infrastructure/persistence/orm-entities/refresh-token.orm-entity';
import { UserOrmEntity } from '@src/infrastructure/persistence/orm-entities/user.orm-entity';
import { PasswordResetTokenTypeOrmRepository } from '@src/infrastructure/persistence/repositories/password-reset-token.typeorm-repository';
import { RefreshTokenTypeOrmRepository } from '@src/infrastructure/persistence/repositories/refresh-token.typeorm-repository';
import { UserTypeOrmRepository } from '@src/infrastructure/persistence/repositories/user.typeorm-repository';
import { ConflictError } from '@src/application/errors';

/** Integração com Postgres real (migrations de produção aplicadas em um banco descartável). */
describe('repositórios de auth (Postgres)', () => {
  let db: TestDatabase;
  let users: UserTypeOrmRepository;
  let refreshTokens: RefreshTokenTypeOrmRepository;
  let resetTokens: PasswordResetTokenTypeOrmRepository;

  const NOW = new Date('2026-10-02T12:00:00.000Z');
  let seq = 0;
  const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

  beforeAll(async () => {
    db = await createTestDatabase({
      schema: 'auth',
      entities: [
        UserOrmEntity,
        RefreshTokenOrmEntity,
        PasswordResetTokenOrmEntity,
        AccountNoticeOrmEntity,
      ],
      migrations: MIGRATIONS,
    });
    const ds = db.dataSource;
    users = new UserTypeOrmRepository(ds.getRepository(UserOrmEntity));
    refreshTokens = new RefreshTokenTypeOrmRepository(ds.getRepository(RefreshTokenOrmEntity));
    resetTokens = new PasswordResetTokenTypeOrmRepository(
      ds.getRepository(PasswordResetTokenOrmEntity),
    );
  });

  afterAll(() => db?.destroy());
  beforeEach(() => db.truncate());

  const makeUser = (kind: 'donor' | 'admin', email: string) => {
    const data = { id: id(), email, passwordHash: 'hash', name: 'Fulano', createdAt: NOW };
    return kind === 'admin' ? User.newAdmin(data) : User.newDonor(data);
  };

  describe('usuários', () => {
    it('salva e busca por id e por e-mail, preservando papel e controle de login', async () => {
      const user = makeUser('donor', 'doador@example.com');
      user.registerFailureLogin(NOW);
      await users.save(user);

      const byEmail = await users.findByEmail('doador@example.com');
      expect(byEmail?.id).toBe(user.id);
      expect(byEmail?.role).toBe(Role.DONOR);
      expect(byEmail?.loginFailures).toBe(1);
      expect((await users.findById(user.id))?.email).toBe('doador@example.com');
      expect(await users.findByEmail('nao@existe.com')).toBeNull();
    });

    it('guarda e-mail e nome cifrados; o login acha a conta pelo índice cego, sem diferenciar maiúsculas', async () => {
      const user = makeUser('donor', 'Doador@Example.com');
      await users.save(user);

      const [raw] = await db.dataSource.query('SELECT * FROM auth.users WHERE id = $1', [user.id]);
      expect(raw.email).toMatch(/^gcm:/);
      expect(raw.name).toMatch(/^gcm:/);
      expect(JSON.stringify(raw)).not.toContain('example.com');
      expect(JSON.stringify(raw)).not.toContain('Fulano');
      expect(raw.emailIndex).toBe(emailIndex('doador@example.com'));

      expect((await users.findByEmail('doador@example.com'))?.id).toBe(user.id);
      expect((await users.findByEmail('  DOADOR@EXAMPLE.COM '))?.id).toBe(user.id);
      expect((await users.findById(user.id))?.name).toBe('Fulano');
    });

    it('volta para o formato em claro (down) e cifra de novo (up), mantendo o login e o aviso pendente', async () => {
      const user = makeUser('donor', 'doador@example.com');
      await users.save(user);
      const notices = new AccountNoticeTypeOrmRepository(
        db.dataSource.getRepository(AccountNoticeOrmEntity),
      );
      await notices.add({
        type: NotificationJobType.PASSWORD_CHANGED,
        userId: user.id,
        name: 'Fulano',
        recipientEmail: 'doador@example.com',
        changedAt: NOW.toISOString(),
      });
      const runner = db.dataSource.createQueryRunner();
      try {
        await new EncryptUserIdentity1763100000000().down(runner);
        const [legacy] = await db.dataSource.query(
          'SELECT email, name FROM auth.users WHERE id = $1',
          [user.id],
        );
        expect(legacy).toEqual({ email: 'doador@example.com', name: 'Fulano' });
        const [notice] = await db.dataSource.query('SELECT payload FROM auth.account_notices');
        expect(notice.payload.recipientEmail).toBe('doador@example.com');

        await new EncryptUserIdentity1763100000000().up(runner);
      } finally {
        await runner.release();
      }
      const [raw] = await db.dataSource.query('SELECT payload FROM auth.account_notices');
      expect(JSON.stringify(raw.payload)).not.toContain('doador@example.com');
      expect((await users.findByEmail('doador@example.com'))?.name).toBe('Fulano');
      expect(await pendingSchemaChanges(db.dataSource)).toEqual([]);
    });

    it('persiste o bloqueio temporário e a troca de senha', async () => {
      const user = makeUser('donor', 'b@example.com');
      for (let i = 0; i < 5; i++) user.registerFailureLogin(NOW);
      await users.save(user);
      expect((await users.findById(user.id))?.isBlocked(NOW)).toBe(true);

      user.changePassword('novo-hash');
      await users.save(user);
      const loaded = await users.findById(user.id);
      expect(loaded?.isBlocked(NOW)).toBe(false);
      expect(loaded?.passwordHash).toBe('novo-hash');
    });

    it('saveLoginState grava só o controle de login, sem desfazer outra gravação', async () => {
      const user = makeUser('donor', 'login@example.com');
      await users.save(user);
      const loginCopy = await users.findById(user.id);

      // Enquanto o login confere a senha, a conta é desativada e a senha trocada.
      const concurrent = await users.findById(user.id);
      concurrent?.changePassword('hash-novo');
      concurrent?.deactivate(2);
      if (concurrent) await users.save(concurrent);

      loginCopy?.registerFailureLogin(NOW);
      if (loginCopy) await users.saveLoginState(loginCopy);

      const loaded = await users.findById(user.id);
      expect(loaded?.loginFailures).toBe(1);
      expect(loaded?.passwordHash).toBe('hash-novo');
      expect(loaded?.active).toBe(false);
    });

    it('e-mail é único: a duplicata vira ConflictError (409), não um erro do banco', async () => {
      await users.save(makeUser('donor', 'dup@example.com'));
      await expect(users.save(makeUser('donor', 'dup@example.com'))).rejects.toThrow(
        new ConflictError('E-mail já cadastrado.'),
      );
    });

    it('conta e lista só admins; findAdminById ignora doadores', async () => {
      const admin = makeUser('admin', 'admin@example.com');
      const admin2 = makeUser('admin', 'admin2@example.com');
      const donor = makeUser('donor', 'donor@example.com');
      await users.save(admin);
      await users.save(admin2);
      await users.save(donor);

      expect(await users.countAdmins()).toBe(2);
      expect(await users.countAdminsActive()).toBe(2);
      expect((await users.listAdmins()).map((u) => u.email).sort()).toEqual([
        'admin2@example.com',
        'admin@example.com',
      ]);
      expect((await users.findAdminById(admin.id))?.id).toBe(admin.id);
      expect(await users.findAdminById(donor.id)).toBeNull();

      admin2.deactivate(2);
      await users.save(admin2);
      expect(await users.countAdminsActive()).toBe(1);
    });

    it('remove apaga o usuário', async () => {
      const user = makeUser('donor', 'x@example.com');
      await users.save(user);
      await users.remove(user.id);
      expect(await users.findById(user.id)).toBeNull();
    });
  });

  it('as migrations criam exatamente o schema das entidades', async () => {
    expect(await pendingSchemaChanges(db.dataSource)).toEqual([]);
  });

  describe('cadastros pendentes de doador', () => {
    it('lista só doadores ativos, sem doador vinculado, criados antes do limite', async () => {
      const old = new Date(NOW.getTime() - 10 * 60_000);
      const mk = (email: string, createdAt: Date) =>
        User.newDonor({ id: id(), email, passwordHash: 'h', name: 'N', createdAt });

      const pending = mk('pendente@example.com', old);
      const recent = mk('recente@example.com', NOW);
      const linked = mk('vinculado@example.com', old);
      linked.linkDonor(id());
      const inactive = mk('inativo@example.com', old);
      inactive.anonymize('x');
      const admin = User.newAdmin({
        id: id(),
        email: 'adm@example.com',
        passwordHash: 'h',
        name: 'A',
        createdAt: old,
      });
      for (const u of [pending, recent, linked, inactive, admin]) await users.save(u);

      const result = await users.listPendingDonors(new Date(NOW.getTime() - 60_000), 10);

      expect(result.map((u) => u.email)).toEqual(['pendente@example.com']);
      expect(await users.listPendingDonors(new Date(NOW.getTime() - 60_000), 0)).toEqual([]);
    });
  });

  describe('refresh tokens', () => {
    const issue = (userId: string, hash: string) =>
      RefreshToken.issue({ id: id(), userId, tokenHash: hash, now: NOW, validity: '7d' });

    it('guarda só o hash e revoga um token específico', async () => {
      const user = makeUser('donor', 'r@example.com');
      await users.save(user);
      await refreshTokens.save(issue(user.id, 'hash-a'));
      await refreshTokens.save(issue(user.id, 'hash-b'));

      expect((await refreshTokens.findByHash('hash-a'))?.isValid(NOW)).toBe(true);

      await refreshTokens.revokeByHash(user.id, 'hash-a', NOW);

      expect((await refreshTokens.findByHash('hash-a'))?.isValid(NOW)).toBe(false);
      expect((await refreshTokens.findByHash('hash-b'))?.isValid(NOW)).toBe(true);
      expect(await refreshTokens.findByHash('inexistente')).toBeNull();
    });

    it('deleteUserTokens apaga todos os tokens do usuário, inclusive os revogados (logout geral)', async () => {
      const user = makeUser('donor', 'r2@example.com');
      const other = makeUser('donor', 'r3@example.com');
      await users.save(user);
      await users.save(other);
      await refreshTokens.save(issue(user.id, 'u1'));
      await refreshTokens.save(issue(user.id, 'u2'));
      await refreshTokens.save(issue(other.id, 'o1'));

      await refreshTokens.revokeByHash(user.id, 'u2', NOW);

      await refreshTokens.deleteUserTokens(user.id);

      expect(await refreshTokens.findByHash('u1')).toBeNull();
      expect(await refreshTokens.findByHash('u2')).toBeNull();
      expect((await refreshTokens.findByHash('o1'))?.isValid(NOW)).toBe(true);
    });
  });

  describe('tokens de redefinição de senha', () => {
    it('salva, marca como usado e invalida os pendentes do usuário', async () => {
      const user = makeUser('donor', 'p@example.com');
      await users.save(user);
      const first = PasswordResetToken.issue({
        id: id(),
        userId: user.id,
        tokenHash: 'reset-1',
        now: NOW,
      });
      await resetTokens.save(first);
      await resetTokens.save(
        PasswordResetToken.issue({ id: id(), userId: user.id, tokenHash: 'reset-2', now: NOW }),
      );

      first.markAsUsed(NOW);
      await resetTokens.save(first);
      expect((await resetTokens.findByHash('reset-1'))?.isValid(NOW)).toBe(false);
      expect((await resetTokens.findByHash('reset-2'))?.isValid(NOW)).toBe(true);

      await resetTokens.invalidateUserPending(user.id, NOW);
      expect((await resetTokens.findByHash('reset-2'))?.isValid(NOW)).toBe(false);
    });
  });

  describe('outbox de avisos da conta', () => {
    const payload = {
      type: NotificationJobType.PASSWORD_CHANGED as const,
      userId: '00000000-0000-4000-8000-0000000000aa',
      name: 'Ana',
      recipientEmail: 'ana@example.com',
      changedAt: NOW.toISOString(),
    };

    it('reserva os vencidos (adiando o vencimento), reagenda e apaga', async () => {
      const notices = new AccountNoticeTypeOrmRepository(
        db.dataSource.getRepository(AccountNoticeOrmEntity),
      );
      await notices.add(payload);

      const lease = new Date(Date.now() + 60_000);
      const [claimed] = await notices.claimDue(10, lease);
      expect(claimed.payload).toEqual(payload);
      // No banco o corpo (nome, e-mail, links com token) fica cifrado por inteiro.
      const [stored] = await db.dataSource.query('SELECT payload FROM auth.account_notices');
      expect(stored.payload).toEqual({ sealed: expect.stringMatching(/^gcm:/) });
      expect(JSON.stringify(stored.payload)).not.toContain('ana@example.com');
      expect(claimed.attempts).toBe(0);
      // Reservado: outra instância não pega o mesmo aviso até o vencimento.
      expect(await notices.claimDue(10, lease)).toEqual([]);

      await notices.reschedule(claimed.id, 1, new Date(Date.now() - 1_000), 'Redis fora');
      const [again] = await notices.claimDue(10, lease);
      expect(again.attempts).toBe(1);

      await notices.remove(again.id);
      expect(await db.dataSource.query('SELECT id FROM auth.account_notices')).toEqual([]);
    });
  });

  describe('unidade de trabalho', () => {
    const newUser = () =>
      User.newDonor({
        id: id(),
        email: `u${seq}@example.com`,
        passwordHash: 'hash',
        name: 'Maria',
        createdAt: NOW,
      });

    it('confirma usuário e tokens juntos', async () => {
      const user = newUser();
      await users.save(user);
      const uow = new TypeOrmUnitOfWork(db.dataSource);

      await uow.run(async (tx) => {
        const loaded = await tx.users.findById(user.id);
        loaded?.anonymize('novo-hash');
        if (loaded) await tx.users.save(loaded);
        await tx.refreshTokens.deleteUserTokens(user.id);
      });

      expect((await users.findById(user.id))?.active).toBe(false);
    });

    it('desfaz tudo quando algo falha no meio (o usuário não fica anonimizado pela metade)', async () => {
      const user = newUser();
      await users.save(user);
      const uow = new TypeOrmUnitOfWork(db.dataSource);

      await expect(
        uow.run(async (tx) => {
          const loaded = await tx.users.findById(user.id);
          loaded?.anonymize('novo-hash');
          if (loaded) await tx.users.save(loaded);
          throw new Error('falha depois de salvar o usuário');
        }),
      ).rejects.toThrow('falha depois');

      const after = await users.findById(user.id);
      expect(after?.active).toBe(true);
      expect(after?.name).toBe('Maria');
    });
  });
});
