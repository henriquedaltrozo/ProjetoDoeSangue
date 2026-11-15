import { calculateNotificationWindow } from '@src/domain/appointment/notification-window';

const NOW = new Date('2026-09-10T12:00:00.000Z');
const inHours = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);
const H = 3_600_000;

describe('calculateNotificationWindow', () => {
  it('com mais de 48 h: lembrete 24 h antes, pedido 48 h antes', () => {
    expect(calculateNotificationWindow(inHours(100), NOW)).toEqual({
      delayReminderMs: 76 * H,
      delayConfirmationMs: 52 * H,
      sendConfirmationRequest: true,
    });
  });

  it('entre 24 h e 48 h: o pedido sai na hora (atraso negativo) e o lembrete continua agendado', () => {
    const window = calculateNotificationWindow(inHours(36), NOW);

    expect(window.delayConfirmationMs).toBe(-12 * H);
    expect(window.delayReminderMs).toBe(12 * H);
    expect(window.sendConfirmationRequest).toBe(true);
  });

  it('com menos de 24 h: só o lembrete, que sai na hora, e nenhum pedido', () => {
    const window = calculateNotificationWindow(inHours(10), NOW);

    expect(window.delayReminderMs).toBe(-14 * H);
    expect(window.sendConfirmationRequest).toBe(false);
  });

  it('exatamente 24 h antes: não há mais tempo para um segundo e-mail', () => {
    const window = calculateNotificationWindow(inHours(24), NOW);

    expect(window.delayReminderMs).toBe(0);
    expect(window.sendConfirmationRequest).toBe(false);
  });
});
