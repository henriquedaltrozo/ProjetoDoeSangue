import type { CollectionUnitDto } from '@/shared/types'

/**
 * Nome da unidade de um agendamento. A lista do doador (`GET /collection-units`) só traz unidades
 * ativas, então uma unidade desativada depois do agendamento não aparece nela: nesse caso mostra
 * "Unidade desativada" em vez do id.
 */
export function unitLabel(units: CollectionUnitDto[] | undefined, unitId: string): string {
  if (!units) {
    return 'Unidade de coleta'
  }
  return units.find((unit) => unit.id === unitId)?.name ?? 'Unidade desativada'
}
