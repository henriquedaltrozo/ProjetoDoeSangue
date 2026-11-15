import { Role } from '../../domain/enums';

/**
 * Quem está executando a operação (identidade já autenticada). É o contrato
 * que a application enxerga; como essa identidade chega (JWT, sessão, fila)
 * é detalhe da presentation/infrastructure.
 */
export interface Actor {
  /** Id do usuário. */
  sub: string;
  email: string;
  role: Role;
  donorId?: string | null;
  /**
   * Confirmou o e-mail (o doador só agenda depois de confirmar). Ausente em tokens emitidos antes da
   * confirmação existir: conta como confirmado.
   */
  emailVerified?: boolean;
}
