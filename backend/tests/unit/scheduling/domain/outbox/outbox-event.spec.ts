import { BusinessRuleError } from '@src/domain/errors';
import {
  OUTBOX_BACKOFF_BASE_MS,
  OUTBOX_BACKOFF_MAX_MS,
  OUTBOX_WAIT_AFTER_FAILURE_MS,
  OUTBOX_MAX_ATTEMPTS,
} from '@src/domain/outbox/outbox.constants';
import {
  OutboxEvent,
  OutboxEventProps,
  OutboxStatus,
  OutboxEventType,
  calculateBackoffMs,
} from '@src/domain/outbox/outbox-event';

const NOW = new Date('2026-09-10T12:00:00.000Z');

function oneEvent(partial: Partial<OutboxEventProps> = {}): OutboxEvent {
  return new OutboxEvent({
    id: 'evt-1',
    type: OutboxEventType.DONATION_COMPLETED,
    payload: { appointmentId: 'ag-1', donorId: 'donor-1' },
    status: OutboxStatus.PENDING,
    attempts: 0,
    reprocessings: 0,
    nextAttemptAt: NOW,
    lastError: null,
    createdAt: NOW,
    processedAt: null,
    ...partial,
  });
}

describe('calculateBackoffMs', () => {
  it('começa na base e cresce exponencialmente', () => {
    expect(calculateBackoffMs(1)).toBe(OUTBOX_BACKOFF_BASE_MS);
    expect(calculateBackoffMs(2)).toBe(OUTBOX_BACKOFF_BASE_MS * 2);
    expect(calculateBackoffMs(3)).toBe(OUTBOX_BACKOFF_BASE_MS * 4);
  });

  it('tem teto', () => {
    expect(calculateBackoffMs(50)).toBe(OUTBOX_BACKOFF_MAX_MS);
    expect(OUTBOX_BACKOFF_MAX_MS).toBe(15 * 60_000);
  });

  it('trata zero tentativas como a primeira', () => {
    expect(calculateBackoffMs(0)).toBe(OUTBOX_BACKOFF_BASE_MS);
  });
});

describe('OutboxEvent', () => {
  describe('donationCompleted', () => {
    it('monta o evento com a data da doação (dia do agendamento) em AAAA-MM-DD', () => {
      expect(
        OutboxEvent.donationCompleted({
          appointmentId: 'ag-1',
          donorId: 'd-1',
          appointmentDateTime: new Date('2026-09-10T23:59:00.000Z'),
        }),
      ).toEqual({
        type: OutboxEventType.DONATION_COMPLETED,
        payload: { appointmentId: 'ag-1', donorId: 'd-1', donationDate: '2026-09-10' },
      });
    });

    it('usa a data de Brasília: agendamento às 22h de 10/09 é doação de 10/09', () => {
      const event = OutboxEvent.donationCompleted({
        appointmentId: 'ag-1',
        donorId: 'd-1',
        appointmentDateTime: new Date('2026-09-11T01:00:00.000Z'),
      });
      expect(event.payload).toMatchObject({ donationDate: '2026-09-10' });
    });
  });

  describe('registerSuccess', () => {
    it('marca PROCESSED, grava o instante e limpa o último erro', () => {
      const event = oneEvent({ attempts: 2, lastError: 'falhou antes' });

      event.registerSuccess(NOW);

      expect(event.status).toBe(OutboxStatus.PROCESSED);
      expect(event.processedAt).toBe(NOW);
      expect(event.lastError).toBeNull();
    });
  });

  describe('registerFailure', () => {
    it('conta a tentativa, guarda o erro e reagenda com backoff, mantendo PENDING', () => {
      const event = oneEvent();

      event.registerFailure('indisponível', NOW);

      expect(event.status).toBe(OutboxStatus.PENDING);
      expect(event.attempts).toBe(1);
      expect(event.lastError).toBe('indisponível');
      expect(event.nextAttemptAt).toEqual(new Date(NOW.getTime() + calculateBackoffMs(1)));
    });

    it('o atraso cresce a cada nova falha', () => {
      const event = oneEvent();

      event.registerFailure('x', NOW);
      const first = event.nextAttemptAt.getTime() - NOW.getTime();
      event.registerFailure('x', NOW);
      const second = event.nextAttemptAt.getTime() - NOW.getTime();

      expect(second).toBe(first * 2);
    });

    it('na última tentativa permitida ainda reagenda (a oitava falha é que esgota)', () => {
      const event = oneEvent({ attempts: OUTBOX_MAX_ATTEMPTS - 2 });

      event.registerFailure('x', NOW);

      expect(event.status).toBe(OutboxStatus.PENDING);
      expect(event.attemptsExhausted()).toBe(false);
    });

    it('ao esgotar as tentativas vai para FAILURE e só pode ser reativado depois da espera de 1 h', () => {
      const event = oneEvent({ attempts: OUTBOX_MAX_ATTEMPTS - 1 });

      event.registerFailure('x', NOW);

      expect(event.status).toBe(OutboxStatus.FAILURE);
      expect(event.attemptsExhausted()).toBe(true);
      expect(event.nextAttemptAt).toEqual(new Date(NOW.getTime() + OUTBOX_WAIT_AFTER_FAILURE_MS));
      expect(OUTBOX_WAIT_AFTER_FAILURE_MS).toBe(60 * 60_000);
    });
  });

  describe('reprocess', () => {
    it('devolve um evento em FAILURE para a fila: PENDING, tentativas zeradas, vence agora', () => {
      const event = oneEvent({
        status: OutboxStatus.FAILURE,
        attempts: OUTBOX_MAX_ATTEMPTS,
        nextAttemptAt: new Date(NOW.getTime() + OUTBOX_WAIT_AFTER_FAILURE_MS),
        reprocessings: 2,
      });

      event.reprocess(NOW);

      expect(event.status).toBe(OutboxStatus.PENDING);
      expect(event.attempts).toBe(0);
      expect(event.nextAttemptAt).toBe(NOW);
      expect(event.reprocessings).toBe(2);
    });

    it.each([OutboxStatus.PENDING, OutboxStatus.PROCESSED])('rejeita no status %s', (status) => {
      expect(() => oneEvent({ status }).reprocess(NOW)).toThrow(BusinessRuleError);
    });
  });
});
