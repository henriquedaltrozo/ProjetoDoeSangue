import { Role } from '@shared/domain/enums';
import {
  SelfDeactivationNotAllowedError,
  AdminAccountNotDeletableError,
  LastAdminActiveError,
} from '../errors/domain.errors';

/** Falhas consecutivas até o bloqueio temporário da conta, e duração do bloqueio. */
export const MAX_FAILURES_LOGIN = 5;
export const BLOCK_LOGIN_MS = 15 * 60 * 1000;
export const BLOCK_LOGIN_MINUTES = BLOCK_LOGIN_MS / 60_000;

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  name: string;
  donorId: string | null;
  active: boolean;
  /** Falhas de login consecutivas (zera no sucesso ou ao bloquear). */
  loginFailures: number;
  /** Enquanto estiver no futuro, o login é recusado (bloqueio temporário por força bruta). */
  blockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  /** Quando o dono confirmou o e-mail atual (pelo link). Null = ainda não confirmou. */
  emailVerifiedAt?: Date | null;
  /** Novo e-mail pedido na troca, à espera de confirmação: o login só muda quando ele for confirmado. */
  pendingEmail?: string | null;
}

export interface NewUserProps {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
}

/**
 * Credenciais e controle de acesso. Dados cadastrais e clínicos do doador
 * vivem no eligibility-service (ver docs/01).
 */
export class User {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly role: Role;
  readonly name: string;
  readonly donorId: string | null;
  readonly active: boolean;
  readonly loginFailures: number;
  readonly blockedUntil: Date | null;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
  readonly emailVerifiedAt: Date | null;
  readonly pendingEmail: string | null;

  constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.role = props.role;
    this.name = props.name;
    this.donorId = props.donorId;
    this.active = props.active;
    this.loginFailures = props.loginFailures;
    this.blockedUntil = props.blockedUntil;
    this.lastLoginAt = props.lastLoginAt;
    this.createdAt = props.createdAt;
    this.emailVerifiedAt = props.emailVerifiedAt ?? null;
    this.pendingEmail = props.pendingEmail ?? null;
  }

  /** O dono confirmou o e-mail atual. */
  get emailVerified(): boolean {
    return this.emailVerifiedAt !== null;
  }

  /** Doador ativo cujo cadastro ainda não foi vinculado a um Donor (saga de cadastro em andamento). */
  get awaitingDonorLink(): boolean {
    return this.role === Role.DONOR && this.active && this.donorId === null;
  }

  /** Doador novo: o e-mail começa sem confirmação (ele confirma pelo link das boas-vindas). */
  static newDonor(data: NewUserProps): User {
    return User.draft(data, Role.DONOR, null);
  }

  /** Admin novo: criado por outro admin (ou pelo token de instalação), o e-mail já conta como confirmado. */
  static newAdmin(data: NewUserProps): User {
    return User.draft(data, Role.ADMIN, data.createdAt);
  }

  private static draft(data: NewUserProps, role: Role, emailVerifiedAt: Date | null): User {
    return new User({
      ...data,
      email: normalizeEmail(data.email),
      role,
      donorId: null,
      active: true,
      loginFailures: 0,
      blockedUntil: null,
      lastLoginAt: null,
      emailVerifiedAt,
      pendingEmail: null,
    });
  }

  isAdmin(): boolean {
    return this.role === Role.ADMIN;
  }

  isDonor(): boolean {
    return this.role === Role.DONOR;
  }

  /** Bloqueio temporário por força bruta ainda vigente? */
  isBlocked(now: Date): boolean {
    return Boolean(this.blockedUntil && this.blockedUntil.getTime() > now.getTime());
  }

  /**
   * Conta a falha e, ao atingir o limite, bloqueia a conta por um período.
   * Devolve true quando esta falha disparou o bloqueio.
   */
  registerFailureLogin(now: Date): boolean {
    this.mutate({ loginFailures: (this.loginFailures ?? 0) + 1 });
    if (this.loginFailures >= MAX_FAILURES_LOGIN) {
      this.mutate({ loginFailures: 0, blockedUntil: new Date(now.getTime() + BLOCK_LOGIN_MS) });
      return true;
    }
    return false;
  }

  registerSuccessfulLogin(now: Date): void {
    this.mutate({ lastLoginAt: now, loginFailures: 0, blockedUntil: null });
  }

  /** Troca a senha e limpa o controle de força bruta. */
  changePassword(newPasswordHash: string): void {
    this.mutate({ passwordHash: newPasswordHash, loginFailures: 0, blockedUntil: null });
  }

  /** Troca o nome e/ou o e-mail de login (o e-mail na forma canônica). */
  updateAccount(data: { name?: string; email?: string }): void {
    this.mutate({
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.email !== undefined && { email: normalizeEmail(data.email) }),
    });
  }

  /** O dono confirmou o e-mail atual pelo link. */
  markEmailVerified(now: Date): void {
    if (!this.emailVerified) this.mutate({ emailVerifiedAt: now });
  }

  /**
   * Pede a troca do e-mail: o novo fica pendente até ser confirmado pelo link enviado a ele (quem
   * trocou precisa ser dono do endereço novo). Pedir de novo o e-mail atual cancela o pedido.
   */
  requestEmailChange(email: string): void {
    const next = normalizeEmail(email);
    this.mutate({ pendingEmail: next === this.email ? null : next });
  }

  /** Confirma a troca pendente: o novo e-mail vira o login, já confirmado. */
  confirmEmailChange(now: Date): void {
    if (!this.pendingEmail) return;
    this.mutate({ email: this.pendingEmail, pendingEmail: null, emailVerifiedAt: now });
  }

  linkDonor(donorId: string): void {
    this.mutate({ donorId: donorId });
  }

  /** Apenas doadores podem pedir a própria exclusão (admins têm ciclo de desativação próprio). */
  verifyCanDeleteOwnAccount(): void {
    if (!this.isDonor()) {
      throw new AdminAccountNotDeletableError();
    }
  }

  /** [LGPD] Remove os dados identificantes e desativa a conta (não é exclusão física). */
  anonymize(randomPasswordHash: string): void {
    this.mutate({
      name: 'Usuário anonimizado',
      email: `anon-${this.id}@anonymized.local`,
      passwordHash: randomPasswordHash,
      active: false,
      pendingEmail: null,
    });
  }

  /** Desativa um admin, preservando sempre ao menos um admin ativo no sistema. */
  deactivate(adminsActive: number): void {
    if (this.active && adminsActive <= 1) {
      throw new LastAdminActiveError();
    }
    this.mutate({ active: false });
  }

  reactivate(): void {
    this.mutate({ active: true });
  }

  /** Único ponto de alteração de estado: só os métodos de domínio mudam a entidade. */
  private mutate(changes: Partial<UserProps>): void {
    Object.assign(this, changes);
  }
}

/**
 * Forma canônica do e-mail de login: sem espaços nas pontas e em minúsculas. "Maria@X.com" e
 * "maria@x.com" são a mesma conta (a parte local é tratada sem diferenciar maiúsculas, como fazem
 * os provedores na prática).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Um admin não pode desativar a própria conta (evita se auto-bloquear). */
export function verifyNotSelfDeactivation(targetId: string, requesterId: string): void {
  if (targetId === requesterId) {
    throw new SelfDeactivationNotAllowedError();
  }
}
