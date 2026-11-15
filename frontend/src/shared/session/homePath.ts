import type { Role } from '@/shared/types'

/** Tela inicial de cada papel: para onde vão o login, o "/" e quem abre uma rota de outro papel. */
export function homePathFor(role: Role): string {
  return role === 'admin' ? '/admin' : '/appointments'
}
