import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePageTitle } from './usePageTitle'

describe('usePageTitle', () => {
  it('define o título da aba com o nome do sistema', () => {
    renderHook(() => usePageTitle('Meu perfil'))
    expect(document.title).toBe('Meu perfil | DoeSangue')
  })
})
