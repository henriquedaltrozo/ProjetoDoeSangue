import { AppointmentOrmEntity } from './appointment.orm-entity';
import { CampaignOrmEntity } from './campaign.orm-entity';
import { OutboxEventOrmEntity } from './outbox-event.orm-entity';
import { CollectionUnitOrmEntity } from './collection-unit.orm-entity';

export { AppointmentOrmEntity, CampaignOrmEntity, OutboxEventOrmEntity, CollectionUnitOrmEntity };

/** Entidades do schema `scheduling`, registradas na conexão do serviço. */
export const ORM_ENTITIES = [
  CollectionUnitOrmEntity,
  CampaignOrmEntity,
  AppointmentOrmEntity,
  OutboxEventOrmEntity,
];
