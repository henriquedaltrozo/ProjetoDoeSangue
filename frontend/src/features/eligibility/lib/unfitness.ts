import type { TemporaryUnfitnessDto } from '@/shared/types'

/**
 * Inaptidão em vigor no dia (mesma regra do backend): já começou e não terminou. Encerrada
 * antecipadamente, vale até a véspera do encerramento; senão, até o fim previsto (inclusive). Só ela
 * pode ser encerrada antecipadamente.
 */
export function isUnfitnessActive(unfitness: TemporaryUnfitnessDto, today: string): boolean {
  if (unfitness.startDate > today) return false
  if (unfitness.actualEndDate) return today < unfitness.actualEndDate
  return unfitness.expectedEndDate === null || today <= unfitness.expectedEndDate
}
