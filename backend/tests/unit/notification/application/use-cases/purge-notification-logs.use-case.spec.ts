import { Logger } from '@nestjs/common';
import {
  NOTIFICATION_LOG_RETENTION_DAYS,
  PurgeNotificationLogsUseCase,
} from '@src/application/use-cases/purge-notification-logs.use-case';
import { NotificationLogCleanupJob } from '@src/infrastructure/jobs/notification-log-cleanup.job';

describe('PurgeNotificationLogsUseCase', () => {
  const now = new Date('2026-11-08T12:00:00.000Z');

  it(`apaga os registros com mais de ${NOTIFICATION_LOG_RETENTION_DAYS} dias e registra quantos`, async () => {
    const logs = { purgeOlderThan: jest.fn().mockResolvedValue(4) };
    const logger = { warn: jest.fn(), error: jest.fn() };

    const purged = await new PurgeNotificationLogsUseCase(logs as never, logger).execute(now);

    expect(purged).toBe(4);
    expect(logs.purgeOlderThan).toHaveBeenCalledWith(
      new Date(now.getTime() - NOTIFICATION_LOG_RETENTION_DAYS * 86_400_000),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('4 registro(s)'),
      expect.any(String),
    );
  });

  it('sem nada para apagar, não registra nada', async () => {
    const logs = { purgeOlderThan: jest.fn().mockResolvedValue(0) };
    const logger = { warn: jest.fn(), error: jest.fn() };

    await new PurgeNotificationLogsUseCase(logs as never, logger).execute(now);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('o job não derruba o serviço se a limpeza falhar', async () => {
    const purge = { execute: jest.fn().mockRejectedValue(new Error('banco fora')) };
    const job = new NotificationLogCleanupJob(purge as never);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(job.run(now)).resolves.toBeUndefined();
  });
});
