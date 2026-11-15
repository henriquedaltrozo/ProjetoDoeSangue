import {
  toAppointmentCreatedResponse,
  toAppointmentResponse,
} from '@src/presentation/http/presenters/appointment.presenter';
import { toCampaignResponse } from '@src/presentation/http/presenters/campaign.presenter';
import { toCollectionUnitResponse } from '@src/presentation/http/presenters/collection-unit.presenter';
import { toOutboxEventResponse } from '@src/presentation/http/presenters/outbox-event.presenter';

const now = new Date('2026-10-02T12:00:00Z');

describe('presenters do scheduling', () => {
  const appointment = {
    id: 'a1',
    donorId: 'd1',
    collectionUnitId: 'c1',
    campaignId: null,
    dateTime: now,
    status: 'SCHEDULED',
    assessmentEligibilityId: null,
    cancellationReason: null,
    confirmedAt: null,
    checkinAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    // campos internos que não podem vazar para a API
    secret: 'x',
  };

  it('Appointment: expõe só os campos do contrato', () => {
    const response = toAppointmentResponse(appointment as never);
    expect(Object.keys(response).sort()).toEqual(
      [
        'id',
        'donorId',
        'collectionUnitId',
        'campaignId',
        'dateTime',
        'status',
        'assessmentEligibilityId',
        'eligibilityNotices',
        'cancellationReason',
        'confirmedAt',
        'checkinAt',
        'completedAt',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
  });

  it('Appointment criado: anexa a avaliação de elegibilidade só quando existe', () => {
    const assessment = { result: 'ELIGIBLE' };
    expect(
      toAppointmentCreatedResponse({ ...appointment, eligibilityAssessment: assessment } as never),
    ).toMatchObject({ id: 'a1', eligibilityAssessment: assessment });
    expect(toAppointmentCreatedResponse(appointment as never)).not.toHaveProperty(
      'eligibilityAssessment',
    );
  });

  it('Campaign, CollectionUnit e OutboxEvent: copiam os campos do contrato', () => {
    expect(toCampaignResponse({ id: 'k1', title: 't', secret: 'x' } as never)).not.toHaveProperty(
      'secret',
    );
    expect(toCollectionUnitResponse({ id: 'u1', name: 'n', secret: 'x' } as never)).toMatchObject({
      id: 'u1',
      name: 'n',
    });
    expect(
      toOutboxEventResponse({ id: 'e1', attempts: 2, lastError: 'x', secret: 'x' } as never),
    ).toMatchObject({ id: 'e1', attempts: 2, lastError: 'x' });
  });
});
