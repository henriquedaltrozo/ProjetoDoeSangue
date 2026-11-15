import { NotificationJobType } from '@shared/domain/enums';
import { NotificationStatus } from '@src/domain/enums';
import {
  createTestDatabase,
  pendingSchemaChanges,
  TestDatabase,
} from '@shared/testing/test-database';
import { NotificationLog } from '@src/domain/entities/notification-log';
import { MIGRATIONS } from '@src/infrastructure/persistence/migrations';
import { ErasedSubjectOrmEntity } from '@src/infrastructure/persistence/orm-entities/erased-subject.orm-entity';
import { NotificationLogOrmEntity } from '@src/infrastructure/persistence/orm-entities/notification-log.orm-entity';
import { NotificationLogTypeOrmRepository } from '@src/infrastructure/persistence/repositories/notification-log.typeorm-repository';
import { SuppressedRecipientOrmEntity } from '@src/infrastructure/persistence/orm-entities/suppressed-recipient.orm-entity';
import { SuppressionListTypeOrmRepository } from '@src/infrastructure/persistence/repositories/suppression-list.typeorm-repository';

/** Integração com Postgres real (migrations de produção aplicadas em um banco descartável). */
describe('repositório de notification (Postgres)', () => {
  let db: TestDatabase;
  let logs: NotificationLogTypeOrmRepository;

  beforeAll(async () => {
    db = await createTestDatabase({
      schema: 'notification',
      entities: [NotificationLogOrmEntity, ErasedSubjectOrmEntity, SuppressedRecipientOrmEntity],
      migrations: MIGRATIONS,
    });
    logs = new NotificationLogTypeOrmRepository(
      db.dataSource.getRepository(NotificationLogOrmEntity),
      db.dataSource.getRepository(ErasedSubjectOrmEntity),
    );
  });

  afterAll(() => db?.destroy());
  beforeEach(() => db.truncate());

  const data = {
    donorId: '00000000-0000-4000-8000-000000000001',
    type: NotificationJobType.REMINDER_24H,
    recipient: 'doador@example.com',
    subject: 'Lembrete',
    message: 'Sua doação é amanhã',
    jobId: 'job-1',
  };

  it('lista de bloqueio: sem diferenciar maiúsculas, atualiza o motivo e desbloqueia', async () => {
    const suppression = new SuppressionListTypeOrmRepository(
      db.dataSource.getRepository(SuppressedRecipientOrmEntity),
    );

    await suppression.add('Fulano@Example.com', 'hard_bounce');
    await suppression.add('fulano@example.com', 'spam');

    expect(await suppression.reasonFor('FULANO@example.com')).toBe('spam');
    expect(await suppression.list(10)).toEqual([
      expect.objectContaining({ email: 'fulano@example.com', reason: 'spam' }),
    ]);
    expect(await suppression.remove('fulano@example.com')).toBe(true);
    expect(await suppression.reasonFor('fulano@example.com')).toBeNull();
    expect(await suppression.remove('fulano@example.com')).toBe(false);
  });

  it('registro de envios: página mais recente primeiro, filtro por status (inclusive SUPPRESSED)', async () => {
    const blocked = NotificationLog.byEmail({ ...data, jobId: 'b' });
    blocked.markSuppressed('hard_bounce');
    await logs.save(NotificationLog.byEmail({ ...data, jobId: 'a' }));
    await logs.save(blocked);

    const all = await logs.listPage(1, 10);
    expect(all.total).toBe(2);
    const onlyBlocked = await logs.listPage(1, 10, NotificationStatus.SUPPRESSED);
    expect(onlyBlocked.items.map((l) => l.jobId)).toEqual(['b']);
    expect(onlyBlocked.items[0].error).toBe('Endereço bloqueado: hard_bounce');
  });

  it('grava o envio com sucesso (SENT)', async () => {
    await logs.save(NotificationLog.byEmail(data));

    const rows = await db.dataSource.query('SELECT * FROM notification.sent_notifications');
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(NotificationStatus.SENT);
    expect(rows[0].recipient).toBe('doador@example.com');
    expect(rows[0].error).toBeNull();
  });

  it('purgeOlderThan apaga só os registros anteriores à data', async () => {
    await logs.save(NotificationLog.byEmail({ ...data, jobId: 'antigo' }));
    await db.dataSource.query(
      `UPDATE notification.sent_notifications SET "sentAt" = now() - interval '200 days' WHERE "jobId" = 'antigo'`,
    );
    await logs.save(NotificationLog.byEmail({ ...data, jobId: 'recente' }));

    expect(await logs.purgeOlderThan(new Date(Date.now() - 180 * 86_400_000))).toBe(1);
    const rows = await db.dataSource.query('SELECT "jobId" FROM notification.sent_notifications');
    expect(rows).toEqual([{ jobId: 'recente' }]);
  });

  it('erasePersonalData (LGPD) apaga destinatário e texto só dos envios do titular', async () => {
    const failed = NotificationLog.byEmail(data);
    failed.markFailure('550 fulano@example.com: mailbox unavailable');
    await logs.save(failed);
    await logs.save(
      NotificationLog.byEmail({
        ...data,
        donorId: '00000000-0000-4000-8000-000000000002',
        recipient: 'outro@example.com',
      }),
    );

    expect(
      await logs.erasePersonalData(
        '00000000-0000-4000-8000-0000000000ff',
        data.donorId,
        '[removido]',
      ),
    ).toBe(1);

    const rows = await db.dataSource.query(
      'SELECT recipient, message, error FROM notification.sent_notifications ORDER BY recipient',
    );
    expect(rows).toEqual([
      // O motivo da falha (que trazia o e-mail) também sai.
      { recipient: '[removido]', message: '[removido]', error: '[removido]' },
      { recipient: 'outro@example.com', message: data.message, error: null },
    ]);
    // O titular fica marcado: e-mails dele que ainda estavam na fila não saem mais.
    expect(await logs.isErased(data.donorId, null)).toBe(true);
    expect(await logs.isErased(null, '00000000-0000-4000-8000-0000000000ff')).toBe(true);
    expect(await logs.isErased('00000000-0000-4000-8000-000000000002', null)).toBe(false);
    // Repetir a exclusão (o job pode ser reprocessado) não falha.
    await logs.erasePersonalData(
      '00000000-0000-4000-8000-0000000000ff',
      data.donorId,
      '[removido]',
    );
  });

  it('as migrations criam exatamente o schema das entidades', async () => {
    expect(await pendingSchemaChanges(db.dataSource)).toEqual([]);
  });

  it('grava a falha com o motivo (FAILURE)', async () => {
    const log = NotificationLog.byEmail({ ...data, jobId: 'job-2' });
    log.markFailure('SMTP indisponível');
    await logs.save(log);

    const [row] = await db.dataSource.query('SELECT * FROM notification.sent_notifications');
    expect(row.status).toBe(NotificationStatus.FAILURE);
    expect(row.error).toBe('SMTP indisponível');
  });

  it('wasSent só reconhece entregas com sucesso do mesmo job e destinatário', async () => {
    const failed = NotificationLog.byEmail({ ...data, jobId: 'job-3' });
    failed.markFailure('SMTP indisponível');
    await logs.save(failed);
    expect(await logs.wasSent('job-3', 'doador@example.com')).toBe(false);

    await logs.save(NotificationLog.byEmail({ ...data, jobId: 'job-3' }));
    expect(await logs.wasSent('job-3', 'doador@example.com')).toBe(true);
    expect(await logs.wasSent('job-3', 'outro@example.com')).toBe(false);
    expect(await logs.wasSent('job-4', 'doador@example.com')).toBe(false);
  });

  it('aceita notificação sem doador (ex.: redefinição de senha, só com userId)', async () => {
    await logs.save(
      NotificationLog.byEmail({
        userId: '00000000-0000-4000-8000-000000000002',
        type: NotificationJobType.RESET_PASSWORD,
        recipient: 'admin@example.com',
        subject: 'Redefinir senha',
        message: 'link',
      }),
    );

    const [row] = await db.dataSource.query('SELECT * FROM notification.sent_notifications');
    expect(row.donorId).toBeNull();
    expect(row.userId).toBe('00000000-0000-4000-8000-000000000002');
  });
});
