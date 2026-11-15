/** Chaves de cache do React Query usadas por mais de uma feature. */
export const QUERY_KEYS = {
  units: ['collection-units'],
  allUnits: ['all-collection-units'],
  myAppointments: ['my-appointments'],
  adminAppointments: ['admin-appointments'],
  availability: ['availability'],
  campaigns: ['campaigns'],
  admins: ['admins'],
  myProfile: ['my-profile'],
  donors: ['donors'],
  donor: ['donor'],
  unfitness: ['unfitness'],
  eligibilityCheck: ['eligibility-check'],
  audit: ['audit'],
} as const
