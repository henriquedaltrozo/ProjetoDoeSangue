import { Clock, LoggerPort } from '@shared/application/ports';
import { Role } from '@shared/domain/enums';
import { Actor } from '@shared/application/auth';
import { PasswordResetToken } from '@src/domain/entities/password-reset-token';
import { RefreshToken } from '@src/domain/entities/refresh-token';
import { User } from '@src/domain/entities/user';
import { AccessTokenIssuer } from '@src/application/ports/access-token-issuer.port';
import { AuthSettings } from '@src/application/ports/auth-settings.port';
import { EligibilityGateway, NewDonor } from '@src/application/ports/eligibility.gateway';
import { IdGenerator } from '@src/application/ports/id-generator.port';
import type { SchedulingGateway } from '@src/application/ports/scheduling.gateway';
import type { TokenRevocation } from '@shared/application/auth';
import type { UpdateDonorIdentityInput } from '@shared/application/dto';
import type {
  AccountNoticeOutbox,
  AccountNoticePayload,
  PendingAccountNotice,
} from '@src/application/ports/account-notice-outbox';
import {
  NotificationPublisher,
  ResetPasswordNotification,
} from '@src/application/ports/notification.publisher';
import { PasswordHasher } from '@src/application/ports/password-hasher.port';
import { PasswordResetTokenRepository } from '@src/application/ports/password-reset-token.repository';
import { RefreshTokenRepository } from '@src/application/ports/refresh-token.repository';
import { TokenGenerator } from '@src/application/ports/token-generator.port';
import type {
  EmailVerificationClaims,
  EmailVerificationTokens,
} from '@src/application/ports/email-verification-tokens.port';
import { VerificationNotices } from '@src/application/services/verification-notices';
import { TransactionalContext, UnitOfWork } from '@src/application/ports/unit-of-work.port';
import { UserRepository } from '@src/application/ports/user.repository';
import { SessionIssuer } from '@src/application/services/session-issuer';

/** Fakes em memória das portas, compartilhados pelos testes dos casos de uso. */

function copy<T extends object>(obj: T): T {
  return Object.assign(Object.create(Object.getPrototypeOf(obj)), obj);
}

export class InMemoryUserRepository implements UserRepository {
  readonly items = new Map<string, User>();
  saves = 0;

  async findById(id: string) {
    const u = this.items.get(id);
    return u ? copy(u) : null;
  }
  async findByEmail(email: string) {
    const u = [...this.items.values()].find(
      (x) => x.email.toLowerCase() === email.trim().toLowerCase(),
    );
    return u ? copy(u) : null;
  }
  async findAdminById(id: string) {
    const u = this.items.get(id);
    return u?.isAdmin() ? copy(u) : null;
  }
  async listAdmins() {
    return [...this.items.values()]
      .filter((u) => u.isAdmin())
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(copy);
  }
  async countAdmins() {
    return [...this.items.values()].filter((u) => u.isAdmin()).length;
  }
  async countAdminsActive() {
    return [...this.items.values()].filter((u) => u.isAdmin() && u.active).length;
  }
  locks = 0;
  async lockAdmins() {
    this.locks += 1;
  }
  async listPendingDonors(createdBefore: Date, limit: number) {
    return [...this.items.values()]
      .filter(
        (u) =>
          u.isDonor() && !u.donorId && u.active && u.createdAt.getTime() < createdBefore.getTime(),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit)
      .map(copy);
  }
  async save(user: User) {
    this.saves++;
    this.items.set(user.id, copy(user));
  }
  loginStateSaves = 0;
  async saveLoginState(user: User) {
    this.loginStateSaves++;
    const stored = this.items.get(user.id);
    if (!stored) return;
    Object.assign(stored, {
      loginFailures: user.loginFailures,
      blockedUntil: user.blockedUntil,
      lastLoginAt: user.lastLoginAt,
    });
  }
  async remove(id: string) {
    this.items.delete(id);
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  readonly items = new Map<string, RefreshToken>();

  async findByHash(tokenHash: string) {
    const t = [...this.items.values()].find((x) => x.tokenHash === tokenHash);
    return t ? copy(t) : null;
  }
  async save(token: RefreshToken) {
    this.items.set(token.id, copy(token));
  }
  async revokeIfActive(tokenId: string, when: Date) {
    const t = this.items.get(tokenId);
    if (!t || t.revokedAt) return false;
    t.revoke(when);
    return true;
  }
  async revokeByHash(userId: string, tokenHash: string, when: Date) {
    for (const t of this.items.values()) {
      if (t.userId === userId && t.tokenHash === tokenHash) t.revoke(when);
    }
  }
  async deleteUserTokens(userId: string) {
    for (const [id, t] of this.items) {
      if (t.userId === userId) this.items.delete(id);
    }
  }
  async purgeExpired(before: Date) {
    let purged = 0;
    for (const [id, t] of this.items) {
      if (t.expiresAt < before) {
        this.items.delete(id);
        purged += 1;
      }
    }
    return purged;
  }
}

export class InMemoryPasswordResetTokenRepository implements PasswordResetTokenRepository {
  readonly items = new Map<string, PasswordResetToken>();

  async findByHash(tokenHash: string) {
    const t = [...this.items.values()].find((x) => x.tokenHash === tokenHash);
    return t ? copy(t) : null;
  }
  async save(token: PasswordResetToken) {
    this.items.set(token.id, copy(token));
  }
  async consumeIfUnused(tokenId: string, when: Date) {
    const t = this.items.get(tokenId);
    if (!t || t.usedAt) return false;
    t.markAsUsed(when);
    return true;
  }
  async invalidateUserPending(userId: string, when: Date) {
    for (const t of this.items.values()) {
      if (t.userId === userId && !t.usedAt) t.markAsUsed(when);
    }
  }
  async purgeExpired(before: Date) {
    let purged = 0;
    for (const [id, t] of this.items) {
      if (t.expiresAt < before) {
        this.items.delete(id);
        purged += 1;
      }
    }
    return purged;
  }
}

export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string) {
    return `hash:${password}`;
  }
  async verify(password: string, hash: string | null) {
    return hash !== null && hash === `hash:${password}`;
  }
}

export class FakeTokenGenerator implements TokenGenerator {
  private n = 0;
  generateRefreshToken() {
    return `refresh-${++this.n}`;
  }
  generateResetToken() {
    return `reset-${++this.n}`;
  }
  hash(token: string) {
    return `sha:${token}`;
  }
}

export class FakeAccessTokenIssuer implements AccessTokenIssuer {
  readonly issued: Actor[] = [];
  async issue(payload: Actor) {
    this.issued.push(payload);
    return 'access-token';
  }
}

export class FakeSchedulingGateway implements SchedulingGateway {
  canceledFor: string[] = [];
  failure: Error | null = null;

  async cancelOpenAppointments(donorId: string) {
    if (this.failure) throw this.failure;
    this.canceledFor.push(donorId);
  }
}

export class FakeEligibilityGateway implements EligibilityGateway {
  created: NewDonor[] = [];
  anonymized: string[] = [];
  failure: Error | null = null;
  async createDonor(donor: NewDonor) {
    if (this.failure) throw this.failure;
    this.created.push(donor);
    return { id: 'donor-1' };
  }
  async anonymizeDonor(donorId: string) {
    this.anonymized.push(donorId);
  }
  identityUpdates: { donorId: string; data: UpdateDonorIdentityInput }[] = [];
  identityFailure: Error | null = null;
  async updateDonorIdentity(donorId: string, data: UpdateDonorIdentityInput) {
    if (this.identityFailure) throw this.identityFailure;
    this.identityUpdates.push({ donorId, data });
  }
  /** Doadores que o eligibility-service "já tem" (userId -> donorId), p.ex. resposta perdida. */
  existing = new Map<string, string>();
  lookupFailure: Error | null = null;
  async findDonorIdByUser(userId: string) {
    if (this.lookupFailure) throw this.lookupFailure;
    return this.existing.get(userId) ?? null;
  }
}

export class FakeNotificationPublisher implements NotificationPublisher {
  sent: ResetPasswordNotification[] = [];
  failure: Error | null = null;
  async enqueueResetPassword(n: ResetPasswordNotification) {
    if (this.failure) throw this.failure;
    this.sent.push(n);
  }
  accountNotices: { payload: AccountNoticePayload; jobId: string }[] = [];
  async enqueueAccountNotice(payload: AccountNoticePayload, jobId: string) {
    if (this.failure) throw this.failure;
    this.accountNotices.push({ payload, jobId });
  }
  erasures: { userId: string; donorId: string | null }[] = [];
  async enqueueErasePersonalData(userId: string, donorId: string | null) {
    if (this.failure) throw this.failure;
    this.erasures.push({ userId, donorId });
  }
}

/** Revogação de tokens em memória: guarda o instante (segundos) da última revogação por usuário. */
export class FakeTokenRevocation implements TokenRevocation {
  readonly revoked = new Map<string, number>();
  async revokeUser(userId: string, at: Date) {
    this.revoked.set(userId, Math.floor(at.getTime() / 1000));
  }
  async revokedAtSeconds(userId: string) {
    return this.revoked.get(userId) ?? null;
  }
}

export class FixedClock implements Clock {
  constructor(public current = new Date('2026-01-01T12:00:00.000Z')) {}
  now() {
    return new Date(this.current.getTime());
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private n = 0;
  newId() {
    return `id-${++this.n}`;
  }
}

/** Token de confirmação legível nos testes: `vt|<usuário>|<e-mail>|<validade em ms>`. */
export class FakeEmailVerificationTokens implements EmailVerificationTokens {
  generate(claims: EmailVerificationClaims, expiresAt: Date) {
    return `vt|${claims.userId}|${claims.email}|${expiresAt.getTime()}`;
  }
  verify(token: string, now: Date) {
    const [tag, userId, email, exp] = token.split('|');
    if (tag !== 'vt' || !userId || !email) return null;
    if (now.getTime() > Number(exp)) return 'expired' as const;
    return { userId, email };
  }
}

export class FakeAuthSettings implements AuthSettings {
  refreshTokenExpiresAt = '7d';
  frontendUrl = 'http://localhost:5173';
  smtpConfigured = false;
  production = false;
}

export class FakeLogger implements LoggerPort {
  notices: string[] = [];
  errors: string[] = [];
  warn(m: string) {
    this.notices.push(m);
  }
  error(m: string) {
    this.errors.push(m);
  }
}

/** Unidade de trabalho fake: entrega os próprios repositórios em memória (sem rollback real). */
/** Outbox de avisos da conta em memória (ordem de criação = ordem de entrega). */
export class InMemoryAccountNoticeOutbox implements AccountNoticeOutbox {
  readonly items = new Map<
    string,
    PendingAccountNotice & { nextAttemptAt: Date; lastError: string | null }
  >();
  private seq = 0;
  constructor(private readonly clock: Clock) {}

  async add(payload: AccountNoticePayload) {
    const id = `notice-${++this.seq}`;
    const now = this.clock.now();
    this.items.set(id, {
      id,
      payload,
      attempts: 0,
      createdAt: now,
      nextAttemptAt: now,
      lastError: null,
    });
  }
  async claimDue(limit: number, leaseUntil: Date) {
    const due = [...this.items.values()]
      .filter((n) => n.nextAttemptAt.getTime() <= this.clock.now().getTime())
      .slice(0, limit);
    for (const n of due) n.nextAttemptAt = leaseUntil;
    return due.map(({ id, payload, attempts, createdAt }) => ({
      id,
      payload,
      attempts,
      createdAt,
    }));
  }
  async remove(id: string) {
    this.items.delete(id);
  }
  async reschedule(id: string, attempts: number, nextAttemptAt: Date, lastError: string) {
    const n = this.items.get(id);
    if (n) Object.assign(n, { attempts, nextAttemptAt, lastError });
  }
  payloads() {
    return [...this.items.values()].map((n) => n.payload);
  }
}

export class FakeUnitOfWork implements UnitOfWork {
  constructor(private readonly context: TransactionalContext) {}
  run<T>(work: (tx: TransactionalContext) => Promise<T>): Promise<T> {
    return work(this.context);
  }
}

/** Monta todas as portas fake e o SessionIssuer; os testes instanciam o caso de uso desejado. */
export function createEnvironment() {
  const env = {
    users: new InMemoryUserRepository(),
    refreshTokens: new InMemoryRefreshTokenRepository(),
    resetTokens: new InMemoryPasswordResetTokenRepository(),
    hasher: new FakePasswordHasher(),
    tokens: new FakeTokenGenerator(),
    accessTokens: new FakeAccessTokenIssuer(),
    eligibility: new FakeEligibilityGateway(),
    scheduling: new FakeSchedulingGateway(),
    revocation: new FakeTokenRevocation(),
    notifications: new FakeNotificationPublisher(),
    clock: new FixedClock(),
    ids: new SequentialIdGenerator(),
    settings: new FakeAuthSettings(),
    logger: new FakeLogger(),
  };
  const sessions = new SessionIssuer(
    env.accessTokens,
    env.refreshTokens,
    env.tokens,
    env.settings,
    env.clock,
    env.ids,
  );
  const accountNotices = new InMemoryAccountNoticeOutbox(env.clock);
  const emailTokens = new FakeEmailVerificationTokens();
  const verificationNotices = new VerificationNotices(emailTokens, env.settings, env.clock);
  const unitOfWork = new FakeUnitOfWork({
    users: env.users,
    refreshTokens: env.refreshTokens,
    resetTokens: env.resetTokens,
    accountNotices,
  });
  return { ...env, sessions, unitOfWork, accountNotices, emailTokens, verificationNotices };
}

export type Environment = ReturnType<typeof createEnvironment>;

/** Cria e persiste um usuário já existente, com a senha em texto `senha` (hash fake). */
export async function seedUser(
  env: Environment,
  extra: Partial<ConstructorParameters<typeof User>[0]> = {},
  password = 'password-correct',
): Promise<User> {
  const user = new User({
    id: `u-${env.users.items.size + 1}`,
    email: 'donor@example.com',
    passwordHash: await env.hasher.hash(password),
    role: Role.DONOR,
    name: 'Maria Doadora',
    donorId: null,
    active: true,
    loginFailures: 0,
    blockedUntil: null,
    lastLoginAt: null,
    createdAt: env.clock.now(),
    ...extra,
  });
  await env.users.save(user);
  env.users.saves = 0;
  return user;
}
