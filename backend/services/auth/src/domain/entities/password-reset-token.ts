/**
 * Validade do token de redefinição de senha. Curta de propósito: o token
 * dá acesso direto à troca de senha da conta, então a janela de exposição
 * (ex.: um e-mail antigo comprometido, ou o link ficando em algum log)
 * precisa ser pequena - reforçado pelo rate limiting em
 * POST /auth/forgot-password e /auth/reset-password.
 */
export const RESET_TOKEN_EXPIRES_IN_MS = 15 * 60 * 1000; // 15min
export const RESET_TOKEN_EXPIRES_IN_MINUTES = RESET_TOKEN_EXPIRES_IN_MS / 60_000;

export interface PasswordResetTokenProps {
  id: string;
  userId: string;
  /** Mesmo padrão do RefreshToken: só o hash SHA-256 é persistido. */
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export class PasswordResetToken {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
  readonly createdAt: Date;

  constructor(props: PasswordResetTokenProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.tokenHash = props.tokenHash;
    this.expiresAt = props.expiresAt;
    this.usedAt = props.usedAt;
    this.createdAt = props.createdAt;
  }

  static issue(data: {
    id: string;
    userId: string;
    tokenHash: string;
    now: Date;
  }): PasswordResetToken {
    return new PasswordResetToken({
      id: data.id,
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: new Date(data.now.getTime() + RESET_TOKEN_EXPIRES_IN_MS),
      usedAt: null,
      createdAt: data.now,
    });
  }

  /** Utilizável = ainda não usado e dentro da validade. */
  isValid(now: Date): boolean {
    return !this.usedAt && !(this.expiresAt.getTime() < now.getTime());
  }

  markAsUsed(now: Date): void {
    this.mutate({ usedAt: now });
  }

  /** Único ponto de alteração de estado: só os métodos de domínio mudam a entidade. */
  private mutate(changes: Partial<PasswordResetTokenProps>): void {
    Object.assign(this, changes);
  }
}
