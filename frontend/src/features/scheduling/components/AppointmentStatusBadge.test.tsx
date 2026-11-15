import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppointmentStatusBadge } from './AppointmentStatusBadge'

describe('AppointmentStatusBadge', () => {
  it('exibe o rótulo em português correspondente ao status', () => {
    render(<AppointmentStatusBadge status="CHECKIN_PERFORMED" />)
    expect(screen.getByText('Check-in realizado')).toBeInTheDocument()
  })

  it('exibe o rótulo de um agendamento cancelado', () => {
    render(<AppointmentStatusBadge status="CANCELED" />)
    expect(screen.getByText('Cancelado')).toBeInTheDocument()
  })

  it('diferencia a presença confirmada de elegibilidade confirmada', () => {
    render(<AppointmentStatusBadge status="CONFIRMED" />)
    expect(screen.getByText('Presença confirmada')).toBeInTheDocument()
  })
})
