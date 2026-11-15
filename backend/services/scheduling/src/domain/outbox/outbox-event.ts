import { BusinessRuleError } from '../errors';
import {
  OUTBOX_BACKOFF_BASE_MS,
  OUTBOX_BACKOFF_MAX_MS,
  OUTBOX_WAIT_AFTER_FAILURE_MS,
  OUTBOX_MAX_ATTEMPTS,
} from './outbox.constants';
import { toBusinessDate } from '@shared/domain/time';

export enum OutboxEventType {
  DONATION_COMPLETED = 'DONATION_COMPLETED',
  /** Campanha urgente criada: avisar os doadores aptos (do tipo sanguíneo dela, se houver). */
  URGENT_CAMPAIGN_CREATED = 'URGENT_CAMPAIGN_CREATED',
  /** Agendamento cancelado: avisar o doador por e-mail. */
  APPOINTMENT_CANCELED = 'APPOINTMENT_CANCELED',
  /** Elegibilidade do agendamento confirmada: enfileirar a confirmação, o lembrete e o pedido de presença. */
  APPOINTMENT_CONFIRMED = 'APPOINTMENT_CONFIRMED',
  /** O doador faltou: convite por e-mail para marcar outro horário. */
  APPOINTMENT_NO_SHOW = 'APPOINTMENT_NO_SHOW',
}

export enum OutboxStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILURE = 'FAILURE',
}

/** `type` (e não `interface`) para ser atribuível a `Record<string, unknown>` sem cast. */
export type DonationCompletedPayload = {
  appointmentId: string;
  donorId: string;
  /** AAAA-MM-DD da conclusão: torna `completeDonation` idempotente mesmo se processado dias depois. */
  donationDate?: string;
};

export type UrgentCampaignCreatedPayload = {
  campaignId: string;
};

export type AppointmentConfirmedPayload = {
  appointmentId: string;
};

export type AppointmentNoShowPayload = {
  appointmentId: string;
  donorId: string;
  collectionUnitId: string;
  /** Data/hora ISO 8601 do agendamento. */
  dateTime: string;
};

export type AppointmentCanceledPayload = {
  appointmentId: string;
  donorId: string;
  collectionUnitId: string;
  /** Data/hora ISO 8601 do agendamento cancelado. */
  dateTime: string;
  reason: string | null;
  /** Cancelado pela equipe (admin ou unidade desativada), e não pelo próprio doador. */
  canceledByStaff: boolean;
};

export interface OutboxEventProps {
  id: string;
  type: OutboxEventType;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  /** Quantas vezes a reconciliação (ou um admin) devolveu o evento de FAILURE para PENDING. */
  reprocessings: number;
  /** PENDING: quando tentar de novo. FAILURE: a partir de quando a reconciliação pode reativá-lo. */
  nextAttemptAt: Date;
  lastError: string | null;
  createdAt: Date;
  processedAt: Date | null;
}

/** Evento ainda não persistido: o estado inicial (PENDING, zero tentativas) vem dos defaults. */
export interface NewOutboxEvent {
  type: OutboxEventType;
  payload: Record<string, unknown>;
}

/** Atraso exponencial entre tentativas (5 s, 10 s, 20 s...), limitado a 15 min. */
export const calculateBackoffMs = (attempts: number): number =>
  Math.min(OUTBOX_BACKOFF_BASE_MS * 2 ** Math.max(attempts - 1, 0), OUTBOX_BACKOFF_MAX_MS);

/**
 * Evento do outbox transacional: gravado na mesma transação da mudança de
 * estado que o originou. Concentra as regras de nova tentativa: backoff
 * exponencial, FAILURE após OUTBOX_MAX_ATTEMPTS e período de espera antes de a
 * reconciliação poder reativá-lo.
 */
export class OutboxEvent implements OutboxEventProps {
  readonly id: string;
  readonly type: OutboxEventType;
  readonly payload: Record<string, unknown>;
  readonly status: OutboxStatus;
  readonly attempts: number;
  readonly reprocessings: number;
  readonly nextAttemptAt: Date;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly processedAt: Date | null;

  constructor(props: OutboxEventProps) {
    Object.assign(this, props);
  }

  /**
   * Evento da pós-doação: atualizar o cadastro do doador e notificá-lo. A data da doação é o dia do
   * agendamento (o check-in só acontece nele), mesmo que a conclusão seja registrada depois.
   */
  static donationCompleted(data: {
    appointmentId: string;
    donorId: string;
    appointmentDateTime: Date;
  }): NewOutboxEvent {
    const payload: DonationCompletedPayload = {
      appointmentId: data.appointmentId,
      donorId: data.donorId,
      // Data de calendário em Brasília: um agendamento às 22h de 10/10 é doação de 10/10, não de 11/10.
      donationDate: toBusinessDate(new Date(data.appointmentDateTime)),
    };
    return { type: OutboxEventType.DONATION_COMPLETED, payload };
  }

  /** E-mails do agendamento confirmado, gravado na mesma transação do resultado da avaliação. */
  static appointmentConfirmed(appointmentId: string): NewOutboxEvent {
    const payload: AppointmentConfirmedPayload = { appointmentId };
    return { type: OutboxEventType.APPOINTMENT_CONFIRMED, payload };
  }

  /** Convite para reagendar, gravado na mesma transação do não comparecimento. */
  static appointmentNoShow(data: {
    appointmentId: string;
    donorId: string;
    collectionUnitId: string;
    dateTime: Date;
  }): NewOutboxEvent {
    const payload: AppointmentNoShowPayload = {
      appointmentId: data.appointmentId,
      donorId: data.donorId,
      collectionUnitId: data.collectionUnitId,
      dateTime: new Date(data.dateTime).toISOString(),
    };
    return { type: OutboxEventType.APPOINTMENT_NO_SHOW, payload };
  }

  /** Aviso de cancelamento ao doador, gravado na mesma transação do novo status. */
  static appointmentCanceled(data: {
    appointmentId: string;
    donorId: string;
    collectionUnitId: string;
    dateTime: Date;
    reason: string | null;
    canceledByStaff: boolean;
  }): NewOutboxEvent {
    const payload: AppointmentCanceledPayload = {
      appointmentId: data.appointmentId,
      donorId: data.donorId,
      collectionUnitId: data.collectionUnitId,
      dateTime: new Date(data.dateTime).toISOString(),
      reason: data.reason,
      canceledByStaff: data.canceledByStaff,
    };
    return { type: OutboxEventType.APPOINTMENT_CANCELED, payload };
  }

  static urgentCampaignCreated(campaignId: string): NewOutboxEvent {
    const payload: UrgentCampaignCreatedPayload = { campaignId };
    return { type: OutboxEventType.URGENT_CAMPAIGN_CREATED, payload };
  }

  /** O handler rodou com sucesso. */
  registerSuccess(now: Date): void {
    this.mutate({ status: OutboxStatus.PROCESSED, processedAt: now, lastError: null });
  }

  /**
   * O handler falhou: conta a tentativa e reagenda com backoff; ao esgotar as
   * tentativas o evento vai para FAILURE e só volta pela reconciliação depois do
   * período de espera (ou por um admin).
   */
  registerFailure(error: string, now: Date): void {
    const attempts = this.attempts + 1;
    const exhausted = attempts >= OUTBOX_MAX_ATTEMPTS;
    this.mutate({
      attempts,
      lastError: error,
      ...(exhausted && { status: OutboxStatus.FAILURE }),
      nextAttemptAt: new Date(
        now.getTime() + (exhausted ? OUTBOX_WAIT_AFTER_FAILURE_MS : calculateBackoffMs(attempts)),
      ),
    });
  }

  attemptsExhausted(): boolean {
    return this.attempts >= OUTBOX_MAX_ATTEMPTS;
  }

  /** Reprocessamento manual: devolve um evento em FAILURE para a fila, zerando as tentativas. */
  reprocess(now: Date): void {
    if (this.status !== OutboxStatus.FAILURE) {
      throw new BusinessRuleError('Só eventos em FAILURE podem ser reprocessados.');
    }
    this.mutate({ status: OutboxStatus.PENDING, attempts: 0, nextAttemptAt: now });
  }

  /** Único ponto de alteração de estado: só os métodos de domínio mudam a entidade. */
  private mutate(changes: Partial<OutboxEventProps>): void {
    Object.assign(this, changes);
  }
}
