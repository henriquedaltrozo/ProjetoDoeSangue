import { oneAppointment, oneCampaign, oneOutboxEvent, oneUnit } from '@test/support/builders';
import {
  toAppointmentOutput,
  toCampaignOutput,
  toCollectionUnitOutput,
  toOutboxEventOutput,
} from '@src/application/dto/outputs';

describe('mappers de saída de scheduling', () => {
  it.each([
    ['agendamento', oneAppointment(), toAppointmentOutput],
    ['campanha', oneCampaign(), toCampaignOutput],
    ['unidade', oneUnit(), toCollectionUnitOutput],
    ['evento de outbox', oneOutboxEvent(), toOutboxEventOutput],
  ] as const)(
    '%s: copia os dados para um objeto simples, sem métodos da entidade',
    (_name, entity, map) => {
      const output = map(entity as never) as unknown as Record<string, unknown>;

      expect(Object.getPrototypeOf(output)).toBe(Object.prototype);
      expect(output).toEqual(expect.objectContaining({ id: (entity as { id: string }).id }));
      expect(output).not.toBe(entity);
      expect(typeof output.ensureActive).toBe('undefined');
      expect(typeof output.cancel).toBe('undefined');
    },
  );

  it('o payload do outbox é copiado (alterar o output não altera a entidade)', () => {
    const event = oneOutboxEvent({ payload: { appointmentId: 'a1' } });
    const output = toOutboxEventOutput(event);

    (output.payload as Record<string, unknown>).appointmentId = 'x';

    expect(event.payload.appointmentId).toBe('a1');
  });

  it('o horário de funcionamento da unidade é copiado', () => {
    const unit = oneUnit({ operatingHours: { mon: ['08:00-12:00'] } });
    const output = toCollectionUnitOutput(unit);

    expect(output.operatingHours).toEqual({ mon: ['08:00-12:00'] });
    expect(output.operatingHours).not.toBe(unit.operatingHours);
  });
});
