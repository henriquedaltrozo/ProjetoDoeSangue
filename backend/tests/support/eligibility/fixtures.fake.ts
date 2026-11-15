import { Sex } from '@shared/domain/enums';
import { UnfitnessCategory } from '@src/domain/enums';
import { Donor, DonorProps } from '@src/domain/entities/donor';
import {
  TemporaryUnfitness,
  TemporaryUnfitnessProps,
} from '@src/domain/entities/temporary-unfitness';
import type { Actor } from '@shared/application/auth';
import { Role } from '@shared/domain/enums';

/** Fábricas de entidades para os testes de domínio e de aplicação. */

export const FIXED_NOW = new Date('2026-10-02T12:00:00.000Z');

/** AAAA-MM-DD de `dias` dias a partir de FIXED_NOW (negativo = passado). */
export function dateWithOffset(days: number): string {
  const d = new Date(FIXED_NOW);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function createTestDonor(overrides: Partial<DonorProps> = {}): Donor {
  return new Donor({
    id: 'donor-1',
    userId: 'user-1',
    completeName: 'Fulano de Tal',
    cpf: '12345678901',
    birthDate: dateWithOffset(-25 * 365),
    sex: Sex.M,
    phone: '11999998888',
    email: 'fulano@example.com',
    weightKg: 70,
    bloodType: null,
    lastDonationAt: null,
    permanentUnfit: false,
    permanentUnfitnessReason: null,
    active: true,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  });
}

export function createTestUnfitness(
  overrides: Partial<TemporaryUnfitnessProps> = {},
): TemporaryUnfitness {
  return new TemporaryUnfitness({
    id: 'unfitness-1',
    donorId: 'donor-1',
    reason: 'tatuagem recente',
    category: UnfitnessCategory.OTHER,
    startDate: dateWithOffset(-5),
    expectedEndDate: null,
    actualEndDate: null,
    registeredBy: null,
    createdAt: FIXED_NOW,
    ...overrides,
  });
}

/** Atores das requisições nos testes: um admin e o doador dono de `donor-1` (ou outro doador). */
export const ADMIN_ACTOR: Actor = { sub: 'admin-1', email: 'admin@x.com', role: Role.ADMIN };
export function donorActor(donorId = 'donor-1'): Actor {
  return { sub: `user-of-${donorId}`, email: 'd@x.com', role: Role.DONOR, donorId };
}
