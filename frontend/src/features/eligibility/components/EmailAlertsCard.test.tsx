import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUpdateProfile } from '@/features/eligibility/hooks/useEligibility'
import type { DonorResponseDto } from '@/shared/types'
import { EmailAlertsCard } from './EmailAlertsCard'

vi.mock('@/features/eligibility/hooks/useEligibility', () => ({ useUpdateProfile: vi.fn() }))

const mutate = vi.fn()
const donor = { id: 'd1', receiveAlerts: true } as DonorResponseDto

describe('EmailAlertsCard', () => {
  beforeEach(() => {
    mutate.mockReset()
    vi.mocked(useUpdateProfile).mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useUpdateProfile>)
  })

  it('mostra a preferência atual e grava ao desmarcar', async () => {
    render(<EmailAlertsCard donor={donor} />)

    const checkbox = screen.getByRole('checkbox', { name: /avisos de campanhas urgentes/ })
    expect(checkbox).toBeChecked()

    await userEvent.click(checkbox)

    expect(mutate).toHaveBeenCalledWith({ receiveAlerts: false })
  })
})
