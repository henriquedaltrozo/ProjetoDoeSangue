import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TransactionalContext, UnitOfWork } from '../../application/ports';
import { AppointmentTypeOrmRepository } from './repositories/appointment.typeorm-repository';
import { CampaignTypeOrmRepository } from './repositories/campaign.typeorm-repository';
import { OutboxTypeOrmRepository } from './repositories/outbox.typeorm-repository';
import { AppointmentOrmEntity } from './orm-entities/appointment.orm-entity';
import { CampaignOrmEntity } from './orm-entities/campaign.orm-entity';
import { OutboxEventOrmEntity } from './orm-entities/outbox-event.orm-entity';

/**
 * Transação TypeORM: os repositórios entregues ao trabalho compartilham o
 * mesmo EntityManager, então o status do agendamento e o evento do outbox
 * (e os locks de horário/SKIP LOCKED) valem na mesma transação.
 */
@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  run<T>(work: (tx: TransactionalContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) =>
      work({
        appointments: new AppointmentTypeOrmRepository(manager.getRepository(AppointmentOrmEntity)),
        campaigns: new CampaignTypeOrmRepository(manager.getRepository(CampaignOrmEntity)),
        outbox: new OutboxTypeOrmRepository(manager.getRepository(OutboxEventOrmEntity)),
      }),
    );
  }
}
