import { emailIndex, encryptValue } from '@shared/infrastructure/persistence';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { NotificationLogRepository } from '../../../application/ports/notification-log.repository';
import { NotificationLog } from '../../../domain/entities/notification-log';
import { NotificationLogMapper } from '../mappers/notification-log.mapper';
import { ErasedSubjectOrmEntity } from '../orm-entities/erased-subject.orm-entity';
import { NotificationLogOrmEntity } from '../orm-entities/notification-log.orm-entity';
import { NotificationStatus } from '../../../domain/enums';

@Injectable()
export class NotificationLogTypeOrmRepository implements NotificationLogRepository {
  constructor(
    @InjectRepository(NotificationLogOrmEntity)
    private readonly repo: Repository<NotificationLogOrmEntity>,
    @InjectRepository(ErasedSubjectOrmEntity)
    private readonly erased: Repository<ErasedSubjectOrmEntity>,
  ) {}

  async save(log: NotificationLog): Promise<void> {
    await this.repo.save(this.repo.create(NotificationLogMapper.toOrm(log)));
  }

  async erasePersonalData(userId: string, donorId: string | null, marker: string): Promise<number> {
    const subjects = [userId, ...(donorId ? [donorId] : [])].map((subjectId) => ({ subjectId }));
    await this.erased.upsert(subjects, ['subjectId']);
    const query = this.repo
      .createQueryBuilder()
      .update(NotificationLogOrmEntity)
      // O motivo da falha também sai: erro de SMTP costuma trazer o endereço do destinatário. As
      // colunas são cifradas, então o marcador entra já cifrado (expressão SQL, sem o transformador).
      .set({
        recipient: () => ':sealedMarker',
        recipientIndex: () => 'NULL',
        message: () => ':sealedMarker',
        error: () => 'CASE WHEN "error" IS NULL THEN NULL ELSE :sealedMarker END',
      })
      .setParameter('sealedMarker', encryptValue(marker))
      .where('"userId" = :userId', { userId });
    if (donorId) {
      query.orWhere('"donorId" = :donorId', { donorId });
    }
    return (await query.execute()).affected ?? 0;
  }

  async isErased(donorId: string | null, userId: string | null): Promise<boolean> {
    const ids = [donorId, userId].filter((id): id is string => Boolean(id));
    if (ids.length === 0) return false;
    return this.erased.exists({ where: { subjectId: In(ids) } });
  }

  async listPage(
    page: number,
    pageSize: number,
    status?: NotificationStatus,
  ): Promise<{ items: NotificationLog[]; total: number }> {
    const [rows, total] = await this.repo.findAndCount({
      where: status ? { status } : {},
      order: { sentAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items: rows.map(NotificationLogMapper.toDomain), total };
  }

  async purgeOlderThan(before: Date): Promise<number> {
    return (await this.repo.delete({ sentAt: LessThan(before) })).affected ?? 0;
  }

  wasSent(jobId: string, recipient: string): Promise<boolean> {
    return this.repo.exists({
      where: { jobId, recipientIndex: emailIndex(recipient), status: NotificationStatus.SENT },
    });
  }
}
