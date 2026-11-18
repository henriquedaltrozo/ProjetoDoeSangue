import { NotificationJobType } from '@shared/domain/enums';
import { DEFAULT_JOB_OPTIONS } from '@shared/infrastructure/messaging';
import { openJson, sealJson } from '@shared/infrastructure/persistence';
import type { Queue } from 'bullmq';
import { NotificationQueuePublisher } from '@src/infrastructure/external/notification-queue.publisher';

describe('NotificationQueuePublisher (scheduling)', () => {
  const job = {
    remove: jest.fn(),
    updateData: jest.fn(),
    data: sealJson({ donorName: 'Ana', confirmationUrl: 'http://x' }),
  };
  const queue = { add: jest.fn(), addBulk: jest.fn(), getJob: jest.fn() };
  const publisher = new NotificationQueuePublisher(queue as unknown as Queue);
  const reminder = {
    type: NotificationJobType.REMINDER_24H as const,
    appointmentId: 'a1',
    donorId: 'd1',
    donorName: 'Ana',
    recipientEmail: 'ana@example.com',
    dateTime: '2026-10-10T13:00:00.000Z',
    collectionUnitName: 'Unidade Central',
  };

  beforeEach(() => jest.clearAllMocks());

  it('agenda o lembrete com jobId fixo por agendamento e sem delay negativo', async () => {
    await publisher.enqueueReminder24H(reminder, -500);
    expect(queue.add).toHaveBeenCalledWith(
      NotificationJobType.REMINDER_24H,
      expect.objectContaining({ sealed: expect.stringMatching(/^gcm:/) }),
      { delay: 0, jobId: 'reminder-a1', ...DEFAULT_JOB_OPTIONS },
    );
    // Nome e e-mail não ficam em claro no Redis.
    const data = queue.add.mock.calls[0][1];
    expect(JSON.stringify(data)).not.toContain('ana@example.com');
    expect(openJson(data)).toEqual(reminder);
  });

  it('cancela lembrete e pedido de confirmação pelo jobId, se ainda existirem', async () => {
    queue.getJob.mockResolvedValueOnce(job).mockResolvedValueOnce(undefined);
    await publisher.cancelReminder24H('a1');
    await publisher.cancelAttendanceConfirmation('a1');
    expect(queue.getJob).toHaveBeenNthCalledWith(1, 'reminder-a1');
    expect(queue.getJob).toHaveBeenNthCalledWith(2, 'confirmation-a1');
    expect(job.remove).toHaveBeenCalledTimes(1);
  });

  it('campanha urgente: um job por doador, com jobId fixo por campanha e doador', async () => {
    await publisher.enqueueUrgentCampaign({
      type: NotificationJobType.URGENT_CAMPAIGN,
      campaignId: 'c1',
      title: 'Precisamos de O-',
      message: 'Estoque crítico.',
      recipients: [
        { donorId: 'd1', donorName: 'Ana', recipientEmail: 'ana@example.com' },
        { donorId: 'd2', donorName: 'Beto', recipientEmail: 'beto@example.com' },
      ],
    });

    const jobs = queue.addBulk.mock.calls[0][0];
    expect(jobs).toHaveLength(2);
    expect(jobs.map((j: { opts: { jobId: string } }) => j.opts.jobId)).toEqual([
      'campaign-c1-d1',
      'campaign-c1-d2',
    ]);
    expect(JSON.stringify(jobs[1].data)).not.toContain('beto@example.com');
    expect(openJson<{ recipients: unknown[] }>(jobs[1].data).recipients).toEqual([
      { donorId: 'd2', donorName: 'Beto', recipientEmail: 'beto@example.com' },
    ]);
  });

  it('confirmação e cancelamento do agendamento: jobId fixo; o cancelamento tira a confirmação da fila', async () => {
    const booked = { ...reminder, type: NotificationJobType.APPOINTMENT_BOOKED as const };
    await publisher.enqueueAppointmentBooked(booked);
    expect(queue.add).toHaveBeenCalledWith(
      NotificationJobType.APPOINTMENT_BOOKED,
      expect.objectContaining({ sealed: expect.any(String) }),
      expect.objectContaining({ jobId: 'booked-a1' }),
    );
    expect(openJson(queue.add.mock.calls[0][1])).toEqual(booked);

    queue.getJob.mockResolvedValueOnce(job);
    await publisher.enqueueAppointmentCanceled({
      ...reminder,
      type: NotificationJobType.APPOINTMENT_CANCELED,
      reason: null,
      canceledByStaff: false,
    });
    expect(queue.add).toHaveBeenLastCalledWith(
      NotificationJobType.APPOINTMENT_CANCELED,
      expect.anything(),
      expect.objectContaining({ jobId: 'canceled-a1' }),
    );
    expect(queue.getJob).toHaveBeenCalledWith('booked-a1');
    expect(job.remove).toHaveBeenCalled();
  });

  it('depois da confirmação, tira o link do lembrete sem removê-lo', async () => {
    queue.getJob.mockResolvedValueOnce(job);
    await publisher.removeReminderLink24h('a1');
    // O job atualizado continua cifrado e só perde o link.
    const updated = job.updateData.mock.calls[0][0];
    expect(updated).toEqual({ sealed: expect.stringMatching(/^gcm:/) });
    expect(openJson(updated)).toEqual({ donorName: 'Ana', confirmationUrl: null });
    expect(job.remove).not.toHaveBeenCalled();
  });
});
