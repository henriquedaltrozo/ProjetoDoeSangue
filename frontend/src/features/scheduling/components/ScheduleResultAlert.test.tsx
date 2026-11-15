import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AppointmentCreatedDto } from '@/shared/types'
import { ScheduleResultAlert } from './ScheduleResultAlert'

const baseAppointment: AppointmentCreatedDto = {
  id: 'appointment-1',
  donorId: 'donor-1',
  collectionUnitId: 'unit-1',
  campaignId: null,
  dateTime: '2026-11-10T12:00:00.000Z',
  status: 'ELIGIBILITY_CONFIRMED',
  assessmentEligibilityId: 'assessment-1',
  eligibilityNotices: [],
  cancellationReason: null,
  confirmedAt: null,
  checkinAt: null,
  completedAt: null,
  createdAt: '2026-10-29T12:00:00.000Z',
  updatedAt: '2026-10-29T12:00:00.000Z',
}

describe('ScheduleResultAlert', () => {
  it('mostra o resultado de um doador apto', () => {
    render(
      <ScheduleResultAlert
        appointment={{
          ...baseAppointment,
          eligibilityAssessment: {
            id: 'assessment-1',
            donorId: 'donor-1',
            appointmentId: 'appointment-1',
            result: 'ELIGIBLE',
            reasons: [],
            notices: [],
            nextEligibilityDate: null,
            origin: 'APPOINTMENT_VALIDATION',
            assessedAt: '2026-10-29T12:00:00.000Z',
          },
        }}
      />,
    )
    expect(screen.getByText('Apto')).toBeInTheDocument()
  })

  it('mostra o aviso para o menor levar o termo do responsável', () => {
    render(
      <ScheduleResultAlert
        appointment={{
          ...baseAppointment,
          eligibilityAssessment: {
            id: 'assessment-1',
            donorId: 'donor-1',
            appointmentId: 'appointment-1',
            result: 'ELIGIBLE',
            reasons: [],
            notices: ['BRING_GUARDIAN_CONSENT'],
            nextEligibilityDate: null,
            origin: 'APPOINTMENT_VALIDATION',
            assessedAt: '2026-10-29T12:00:00.000Z',
          },
        }}
      />,
    )
    expect(screen.getByText(/termo de consentimento assinado pelo seu responsável/)).toBeInTheDocument()
  })

  it('mostra os motivos e a próxima data de um doador inapto', () => {
    render(
      <ScheduleResultAlert
        appointment={{
          ...baseAppointment,
          status: 'ELIGIBILITY_DENIED',
          eligibilityAssessment: {
            id: 'assessment-1',
            donorId: 'donor-1',
            appointmentId: 'appointment-1',
            result: 'TEMPORARY_UNFIT',
            reasons: ['MIN_INTERVAL_NOT_FULFILLED'],
            notices: [],
            nextEligibilityDate: '2026-12-20',
            origin: 'APPOINTMENT_VALIDATION',
            assessedAt: '2026-10-29T12:00:00.000Z',
          },
        }}
      />,
    )
    expect(screen.getByText('Inapto temporariamente')).toBeInTheDocument()
    expect(screen.getByText('Intervalo mínimo entre doações não cumprido')).toBeInTheDocument()
    expect(screen.getByText(/20\/12\/2026/)).toBeInTheDocument()
  })
})
