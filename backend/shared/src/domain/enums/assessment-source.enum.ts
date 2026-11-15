export enum AssessmentSource {
  DONOR_QUERY = 'DONOR_QUERY',
  APPOINTMENT_VALIDATION = 'APPOINTMENT_VALIDATION',
  /** Reavaliação automática feita pelo scheduling depois de uma doação concluída (só pela rota interna). */
  POST_DONATION = 'POST_DONATION',
}
