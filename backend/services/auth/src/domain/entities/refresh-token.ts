import { sumDuration } from '../services/duration';

export interface RefreshTokenProps {
  id: string;
  userId: string;
  /** Só o hash SHA-256 é persistido, nunca o token em texto puro. */
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export class RefreshToken {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;

  constructor(props: RefreshTokenProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.tokenHash = props.tokenHash;
    this.expiresAt = props.expiresAt;
    this.revokedAt = props.revokedAt;
    this.createdAt = props.createdAt;
  }

  static issue(data: {
    id: string;
    userId: string;
    tokenHash: string;
    now: Date;
    validity: string;
  }): RefreshToken {
    return new RefreshToken({
      id: data.id,
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: sumDuration(data.now, data.validity),
      revokedAt: null,
      createdAt: data.now,
    });
  }

  /** Válido = não revogado e ainda dentro da validade. */
  isValid(now: Date): boolean {
    return !this.revokedAt && !(this.expiresAt.getTime() < now.getTime());
  }

  revoke(now: Date): void {
    this.mutate({ revokedAt: now });
  }

  /** Único ponto de alteração de estado: só os métodos de domínio mudam a entidade. */
  private mutate(changes: Partial<RefreshTokenProps>): void {
    Object.assign(this, changes);
  }
}
