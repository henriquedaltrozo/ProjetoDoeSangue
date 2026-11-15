import { Role } from '@shared/domain/enums';
import { User } from '../../domain/entities/user';

export interface UserOutput {
  id: string;
  email: string;
  name: string;
  role: Role;
  donorId: string | null;
  active: boolean;
  /** Confirmou o e-mail atual (sem confirmar, o doador não agenda). */
  emailVerified: boolean;
  /** Novo e-mail à espera de confirmação (troca de e-mail), se houver. */
  pendingEmail: string | null;
}

/** Resultado da emissão de sessão (a camada HTTP move o refresh token para o cookie). */
export interface AuthResult {
  accessToken: string;
  user: UserOutput;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export function toUserOutput(user: User): UserOutput {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    donorId: user.donorId,
    active: user.active,
    emailVerified: user.emailVerified,
    pendingEmail: user.pendingEmail,
  };
}
