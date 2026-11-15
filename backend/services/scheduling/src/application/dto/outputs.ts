import type { AssessmentNotice, BloodType } from '@shared/domain/enums';
import type { AppointmentStatus, CampaignType } from '../../domain/enums';
import type { Appointment } from '../../domain/appointment/appointment';
import type { Campaign } from '../../domain/campaign/campaign';
import type { CollectionUnit, OperatingHours } from '../../domain/collection-unit/collection-unit';
import type { OutboxEvent, OutboxEventType, OutboxStatus } from '../../domain/outbox/outbox-event';

/**
 * Saídas dos casos de uso: dados somente leitura, copiados da entidade por mappers.
 * A presentation só enxerga estes tipos; as entidades de domínio nunca saem do application.
 */
export interface AppointmentOutput {
  readonly id: string;
  /** Referência lógica a eligibility.donors.id - sem FK entre schemas. */
  readonly donorId: string;
  readonly collectionUnitId: string;
  readonly campaignId: string | null;
  readonly dateTime: Date;
  readonly status: AppointmentStatus;
  /** Referência lógica a eligibility.eligibility_assessments.id. */
  readonly assessmentEligibilityId: string | null;
  /** Avisos da avaliação que confirmou o agendamento (ex.: levar o termo do responsável). */
  readonly eligibilityNotices: AssessmentNotice[];
  readonly cancellationReason: string | null;
  /** Quando o doador (ou um admin) confirmou a presença; nulo enquanto não confirmou. */
  readonly confirmedAt: Date | null;
  readonly checkinAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CampaignOutput {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly type: CampaignType;
  readonly targetBloodType: BloodType | null;
  readonly collectionUnitId: string | null;
  /** Data (AAAA-MM-DD). */
  readonly startDate: string;
  /** Data (AAAA-MM-DD). */
  readonly endDate: string;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CollectionUnitOutput {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  /** Null nas unidades cadastradas antes do campo existir. */
  readonly neighborhood: string | null;
  readonly city: string;
  readonly uf: string;
  readonly phone: string;
  readonly simultaneousCapacity: number;
  /** Estrutura por dia da semana, ex: {"seg": ["08:00-17:00"]}. Informativo por enquanto. */
  readonly operatingHours: OperatingHours | null;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface OutboxEventOutput {
  readonly id: string;
  readonly type: OutboxEventType;
  readonly payload: Record<string, unknown>;
  readonly status: OutboxStatus;
  readonly attempts: number;
  /** Quantas vezes a reconciliação (ou um admin) devolveu o evento de FAILURE para PENDING. */
  readonly reprocessings: number;
  /** PENDING: quando tentar de novo. FAILURE: a partir de quando a reconciliação pode reativá-lo. */
  readonly nextAttemptAt: Date;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly processedAt: Date | null;
}

export function toAppointmentOutput(entity: Appointment): AppointmentOutput {
  return {
    id: entity.id,
    donorId: entity.donorId,
    collectionUnitId: entity.collectionUnitId,
    campaignId: entity.campaignId,
    dateTime: entity.dateTime,
    status: entity.status,
    assessmentEligibilityId: entity.assessmentEligibilityId,
    eligibilityNotices: [...entity.eligibilityNotices],
    cancellationReason: entity.cancellationReason,
    confirmedAt: entity.confirmedAt,
    checkinAt: entity.checkinAt,
    completedAt: entity.completedAt,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export function toCampaignOutput(entity: Campaign): CampaignOutput {
  return {
    id: entity.id,
    title: entity.title,
    description: entity.description,
    type: entity.type,
    targetBloodType: entity.targetBloodType,
    collectionUnitId: entity.collectionUnitId,
    startDate: entity.startDate,
    endDate: entity.endDate,
    active: entity.active,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export function toCollectionUnitOutput(entity: CollectionUnit): CollectionUnitOutput {
  return {
    id: entity.id,
    name: entity.name,
    address: entity.address,
    neighborhood: entity.neighborhood,
    city: entity.city,
    uf: entity.uf,
    phone: entity.phone,
    simultaneousCapacity: entity.simultaneousCapacity,
    operatingHours: entity.operatingHours ? { ...entity.operatingHours } : null,
    active: entity.active,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export function toOutboxEventOutput(entity: OutboxEvent): OutboxEventOutput {
  return {
    id: entity.id,
    type: entity.type,
    payload: { ...entity.payload },
    status: entity.status,
    attempts: entity.attempts,
    reprocessings: entity.reprocessings,
    nextAttemptAt: entity.nextAttemptAt,
    lastError: entity.lastError,
    createdAt: entity.createdAt,
    processedAt: entity.processedAt,
  };
}

export type { OutboxEventType, OutboxStatus } from '../../domain/outbox/outbox-event';
