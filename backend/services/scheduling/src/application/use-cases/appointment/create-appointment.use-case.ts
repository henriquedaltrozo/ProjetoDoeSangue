import { type AppointmentOutput, toAppointmentOutput } from '../../dto';
import { AssessmentSource, EligibilityResult, Role } from '@shared/domain/enums';
import { AppointmentStatus } from '../../../domain/enums';
import { EligibilityAssessmentOutput } from '@shared/application/dto';
import { Actor } from '@shared/application/auth';
import { Appointment, NewAppointment } from '../../../domain/appointment';
import { CollectionUnit } from '../../../domain/collection-unit';
import { BusinessRuleError } from '../../../domain/errors';
import { OutboxEvent } from '../../../domain/outbox';
import { AccessDeniedError } from '../../errors';
import {
  APPOINTMENT_REPOSITORY,
  AVAILABILITY_CACHE,
  AppointmentRepository,
  AvailabilityCache,
  CAMPAIGN_REPOSITORY,
  CLOCK,
  CampaignRepository,
  Clock,
  ELIGIBILITY_GATEWAY,
  EligibilityGateway,
  COLLECTION_UNIT_REPOSITORY,
  UNIT_OF_WORK,
  CollectionUnitRepository,
  UnitOfWork,
} from '../../ports';
import { loadCampaignOrFail, loadCollectionUnitOrFail } from '../shared/load-or-fail';

export interface CreateAppointmentCommand {
  donorId: string;
  collectionUnitId: string;
  campaignId?: string;
  /** Data/hora ISO 8601. */
  dateTime: string;
}

/** O agendamento criado, com o resultado da avaliação de elegibilidade anexado. */
export type AppointmentCreated = AppointmentOutput & {
  eligibilityAssessment?: EligibilityAssessmentOutput;
};

export class CreateAppointmentUseCase {
  static readonly inject = [
    APPOINTMENT_REPOSITORY,
    COLLECTION_UNIT_REPOSITORY,
    CAMPAIGN_REPOSITORY,
    UNIT_OF_WORK,
    ELIGIBILITY_GATEWAY,
    AVAILABILITY_CACHE,
    CLOCK,
  ] as const;

  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly units: CollectionUnitRepository,
    private readonly campaigns: CampaignRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly eligibility: EligibilityGateway,
    private readonly cache: AvailabilityCache,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateAppointmentCommand, user: Actor): Promise<AppointmentCreated> {
    this.ensureCanScheduleFor(command.donorId, user);

    const draft = Appointment.draft(
      {
        donorId: command.donorId,
        collectionUnitId: command.collectionUnitId,
        campaignId: command.campaignId,
        dateTime: new Date(command.dateTime),
      },
      this.clock.now(),
    );

    const unit = await this.findActiveUnit(command.collectionUnitId);
    unit.ensureOpenAt(draft.dateTime);
    await this.ensureCampaignAccepts(command.campaignId, unit.id, draft.dateTime);

    const appointment = await this.reserveSlot(unit, draft);
    const assessment = await this.assessOrReleaseSlot(appointment);
    return this.applyAssessment(appointment, unit, assessment);
  }

  /**
   * O doador agenda só para si e só depois de confirmar o e-mail (os avisos do agendamento vão para
   * ele). A equipe (admin) agenda para qualquer doador. Token sem o claim (emitido antes da
   * confirmação existir) conta como confirmado.
   */
  private ensureCanScheduleFor(donorId: string, user: Actor): void {
    if (user.role === Role.ADMIN) return;
    if (user.donorId !== donorId) {
      throw new AccessDeniedError('Você só pode agendar para si mesmo.');
    }
    if (user.emailVerified === false) {
      throw new AccessDeniedError(
        'Confirme seu e-mail para agendar: use o link que enviamos ao seu endereço (na página inicial você pode pedir outro).',
      );
    }
  }

  private async findActiveUnit(id: string): Promise<CollectionUnit> {
    const unit = await loadCollectionUnitOrFail(this.units, id);
    unit.ensureActive();
    return unit;
  }

  private async ensureCampaignAccepts(
    id: string | undefined,
    unitId: string,
    dateTime: Date,
  ): Promise<void> {
    if (!id) return;
    const campaign = await loadCampaignOrFail(this.campaigns, id);
    campaign.ensureAcceptsAppointment(unitId, dateTime);
  }

  /**
   * Checagens + reserva numa transação com o doador e o horário travados: um doador só tem um
   * agendamento em aberto por vez (senão ocuparia várias vagas e poderia doar duas vezes sem
   * respeitar o intervalo), e o horário não passa da capacidade - mesmo sob concorrência e sem uma
   * tabela extra de "posições".
   */
  private reserveSlot(unit: CollectionUnit, draft: NewAppointment): Promise<Appointment> {
    return this.unitOfWork.run(async (tx) => {
      await tx.appointments.blockDonor(draft.donorId);
      if ((await tx.appointments.countOpenByDonor(draft.donorId, this.clock.now())) > 0) {
        throw new BusinessRuleError(
          'Já existe um agendamento em aberto para este doador. Cancele-o ou aguarde a doação antes de agendar outro.',
        );
      }
      await tx.appointments.blockTime(draft.collectionUnitId, draft.dateTime);
      const occupied = await tx.appointments.countOccupied(draft.collectionUnitId, draft.dateTime);
      unit.ensureAvailableSlot(occupied);
      return tx.appointments.create(draft);
    });
  }

  /**
   * Avalia a elegibilidade no eligibility-service. Sem transação distribuída: se a chamada falhar
   * (não "negar", falhar mesmo), desfaz a reserva para não prender uma vaga por um agendamento que
   * nunca foi avaliado (mesmo padrão de compensação do auth-service). Só a chamada remota fica
   * protegida: depois que a avaliação volta, o agendamento é válido e nenhuma falha posterior o apaga.
   */
  private async assessOrReleaseSlot(
    appointment: Appointment,
  ): Promise<EligibilityAssessmentOutput> {
    try {
      return await this.eligibility.assessInternal({
        donorId: appointment.donorId,
        origin: AssessmentSource.APPOINTMENT_VALIDATION,
        appointmentId: appointment.id,
        // A idade conta no dia da doação, não no dia em que se agenda.
        donationDate: appointment.businessDay(),
      });
    } catch (err) {
      await this.appointments.remove(appointment.id);
      await this.cache.invalidateDay(appointment.collectionUnitId, appointment.dateTime);
      throw err;
    }
  }

  /**
   * Grava o resultado da avaliação e invalida o cache do dia. Se o doador está apto, o evento que
   * agenda os e-mails (confirmação, lembrete, pedido de presença) vai para o outbox na mesma
   * transação: com a fila fora do ar, os e-mails saem quando ela voltar, em vez de se perderem.
   */
  private async applyAssessment(
    appointment: Appointment,
    unit: CollectionUnit,
    assessment: EligibilityAssessmentOutput,
  ): Promise<AppointmentCreated> {
    appointment.registerEligibilityAssessment(
      assessment.id,
      assessment.result === EligibilityResult.ELIGIBLE,
      assessment.notices,
    );
    const saved = await this.unitOfWork.run(async (tx) => {
      const updated = await tx.appointments.save(appointment);
      if (updated.status === AppointmentStatus.ELIGIBILITY_CONFIRMED) {
        await tx.outbox.create(OutboxEvent.appointmentConfirmed(updated.id));
      }
      return updated;
    });
    await this.cache.invalidateDay(unit.id, saved.dateTime);

    return { ...toAppointmentOutput(saved), eligibilityAssessment: assessment };
  }
}
