import { Role } from '@shared/domain/enums';
import {
  SelfDeactivationNotAllowedError,
  AdminAccountNotDeletableError,
  LastAdminActiveError,
} from '@src/domain/errors/domain.errors';
import {
  BLOCK_LOGIN_MS,
  MAX_FAILURES_LOGIN,
  User,
  type UserProps,
  verifyNotSelfDeactivation,
} from '@src/domain/entities/user';

const now = new Date('2026-01-01T12:00:00.000Z');
/** Usuário já em um estado específico (o estado só muda por métodos de domínio). */
const withState = (user: User, state: Partial<UserProps>): User =>
  new User({ ...(user as UserProps), ...state });

const data = { id: 'u-1', email: 'a@x.com', passwordHash: 'h', name: 'Fulano', createdAt: now };

describe('User', () => {
  it('newDonor cria conta ativa, sem doador vinculado e sem falhas', () => {
    const u = User.newDonor(data);
    expect(u).toMatchObject({
      role: Role.DONOR,
      active: true,
      donorId: null,
      loginFailures: 0,
      blockedUntil: null,
      lastLoginAt: null,
    });
    expect(u.isDonor()).toBe(true);
    expect(u.isAdmin()).toBe(false);
  });

  it('newAdmin cria conta com role ADMIN', () => {
    expect(User.newAdmin(data).isAdmin()).toBe(true);
  });

  it('grava o e-mail em minúsculas e sem espaços nas pontas', () => {
    expect(User.newDonor({ ...data, email: ' Maria@X.com ' }).email).toBe('maria@x.com');
  });

  describe('bloqueio por força bruta', () => {
    it('não bloqueia antes de atingir o limite de falhas', () => {
      const u = User.newDonor(data);
      for (let i = 1; i < MAX_FAILURES_LOGIN; i++) {
        expect(u.registerFailureLogin(now)).toBe(false);
      }
      expect(u.loginFailures).toBe(MAX_FAILURES_LOGIN - 1);
      expect(u.isBlocked(now)).toBe(false);
    });

    it('bloqueia por 15 min na falha do limite e zera o contador', () => {
      const u = withState(User.newDonor(data), { loginFailures: MAX_FAILURES_LOGIN - 1 });

      expect(u.registerFailureLogin(now)).toBe(true);

      expect(u.loginFailures).toBe(0);
      expect(u.blockedUntil?.getTime()).toBe(now.getTime() + BLOCK_LOGIN_MS);
      expect(u.isBlocked(now)).toBe(true);
      expect(u.isBlocked(new Date(now.getTime() + BLOCK_LOGIN_MS))).toBe(false);
    });

    it('login bem-sucedido zera falhas e bloqueio e registra o horário', () => {
      const u = withState(User.newDonor(data), {
        loginFailures: 3,
        blockedUntil: new Date(now.getTime() + 1000),
      });
      u.registerSuccessfulLogin(now);
      expect(u).toMatchObject({ loginFailures: 0, blockedUntil: null, lastLoginAt: now });
    });
  });

  it('changePassword atualiza o hash e limpa o controle de força bruta', () => {
    const u = withState(User.newDonor(data), {
      loginFailures: 2,
      blockedUntil: new Date(now.getTime() + 1000),
    });
    u.changePassword('new');
    expect(u).toMatchObject({ passwordHash: 'new', loginFailures: 0, blockedUntil: null });
  });

  it('anonimizar remove dados identificantes e desativa', () => {
    const u = User.newDonor(data);
    u.anonymize('hash-random');
    expect(u).toMatchObject({
      name: 'Usuário anonimizado',
      email: 'anon-u-1@anonymized.local',
      passwordHash: 'hash-random',
      active: false,
    });
  });

  it('só doadores podem excluir a própria conta', () => {
    expect(() => User.newDonor(data).verifyCanDeleteOwnAccount()).not.toThrow();
    expect(() => User.newAdmin(data).verifyCanDeleteOwnAccount()).toThrow(
      AdminAccountNotDeletableError,
    );
  });

  describe('desativar / reativar', () => {
    it('não desativa o último admin ativo', () => {
      expect(() => User.newAdmin(data).deactivate(1)).toThrow(LastAdminActiveError);
    });

    it('desativa quando há outros admins ativos e reativa depois', () => {
      const u = User.newAdmin(data);
      u.deactivate(2);
      expect(u.active).toBe(false);
      u.reactivate();
      expect(u.active).toBe(true);
    });

    it('desativar um admin já inativo não depende da contagem', () => {
      const u = withState(User.newAdmin(data), { active: false });
      expect(() => u.deactivate(0)).not.toThrow();
    });
  });

  it('verifyNotSelfDeactivation recusa o próprio id', () => {
    expect(() => verifyNotSelfDeactivation('a', 'a')).toThrow(SelfDeactivationNotAllowedError);
    expect(() => verifyNotSelfDeactivation('a', 'b')).not.toThrow();
  });
});
