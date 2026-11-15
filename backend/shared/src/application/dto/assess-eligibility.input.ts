import { AssessmentSource } from '../../domain/enums/assessment-source.enum';

/** Entrada do caso de uso de avaliação de elegibilidade (consulta espontânea ou validação do scheduling). */
export interface AssessEligibilityInput {
  donorId: string;
  origin: AssessmentSource;
  appointmentId?: string;
  /**
   * Dia da doação pretendida (AAAA-MM-DD), quando a avaliação é de um agendamento: as regras de idade
   * são conferidas nesse dia, e não no dia em que se agenda.
   */
  donationDate?: string;
}
