import { Role } from '../../domain/enums';
import { AccessDeniedError } from '../errors';
import type { Actor } from './actor';

/**
 * Regra de autorização "por doador": o admin age sobre qualquer registro; o
 * doador, só sobre os próprios (donorId vem da identidade autenticada).
 */
export function requireOwnerOrAdmin(
  actor: Actor,
  donorId: string,
  denialMessage = 'Você não tem acesso a este recurso.',
): void {
  if (actor.role !== Role.ADMIN && actor.donorId !== donorId) {
    throw new AccessDeniedError(denialMessage);
  }
}
