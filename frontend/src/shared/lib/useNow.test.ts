import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from './useNow'

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-29T09:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('avança o horário a cada intervalo, sem precisar recarregar a tela', () => {
    const { result } = renderHook(() => useNow(60_000))
    expect(result.current).toBe(Date.parse('2026-10-29T09:00:00.000Z'))

    act(() => vi.advanceTimersByTime(60_000))

    expect(result.current).toBe(Date.parse('2026-10-29T09:01:00.000Z'))
  })
})
