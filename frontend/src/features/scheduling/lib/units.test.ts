import { describe, expect, it } from 'vitest'
import type { CollectionUnitDto } from '@/shared/types'
import { unitLabel } from './units'

const unit = { id: 'unit-1', name: 'Hemocentro Centro' } as CollectionUnitDto

describe('unitLabel', () => {
  it('mostra o nome da unidade encontrada', () => {
    expect(unitLabel([unit], 'unit-1')).toBe('Hemocentro Centro')
  })

  it('mostra "Unidade desativada" quando a unidade não está na lista (nunca o id)', () => {
    expect(unitLabel([unit], 'unit-removida')).toBe('Unidade desativada')
  })

  it('mostra um texto neutro enquanto a lista ainda não carregou', () => {
    expect(unitLabel(undefined, 'unit-1')).toBe('Unidade de coleta')
  })
})
