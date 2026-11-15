import { Clock, LoggerPort } from '@shared/application/ports';
import { AccessAudit, NewAccessAudit } from '@src/domain/entities/access-audit';
import {
  EligibilityAssessment,
  NewEligibilityAssessment,
} from '@src/domain/entities/assessment-eligibility';
import { Donor, NewDonor } from '@src/domain/entities/donor';
import {
  TemporaryUnfitness,
  NewTemporaryUnfitness,
} from '@src/domain/entities/temporary-unfitness';
import { FIXED_NOW } from '@test/support/fixtures.fake';
import type { AuditRepository } from '@src/application/ports/audit.repository';
import type { AssessmentRepository } from '@src/application/ports/assessment.repository';
import type { DonorRepository } from '@src/application/ports/donor.repository';
import type { UnfitnessRepository } from '@src/application/ports/unfitness.repository';
import { AuditTrail } from '@src/application/services/audit-trail';
import { ConflictError } from '@src/application/errors';

/** Dublês em memória das portas, usados nos testes dos casos de uso. */

export class FixedClock implements Clock {
  constructor(private readonly instant: Date = FIXED_NOW) {}

  now(): Date {
    return new Date(this.instant);
  }
}

export class InMemoryDonorRepository implements DonorRepository {
  readonly items = new Map<string, Donor>();
  saves = 0;
  private sequence = 0;

  seed(...donors: Donor[]): void {
    for (const d of donors) {
      this.items.set(d.id, d);
    }
  }

  async findById(id: string) {
    return this.items.get(id) ?? null;
  }

  async findByUserId(userId: string) {
    return [...this.items.values()].find((d) => d.userId === userId) ?? null;
  }

  async findByCpfOrUserId(cpf: string, userId: string) {
    return [...this.items.values()].find((d) => d.cpf === cpf || d.userId === userId) ?? null;
  }

  async listAcceptingAlerts(bloodType?: string) {
    return [...this.items.values()].filter(
      (d) =>
        d.active && d.receiveAlerts && d.emailVerified && (!bloodType || d.bloodType === bloodType),
    );
  }

  async find(search: string | undefined, limit: number, offset = 0) {
    const term = search?.toLowerCase();
    const found = [...this.items.values()]
      .filter(
        (d) =>
          d.active &&
          (!term ||
            d.completeName.toLowerCase().includes(term) ||
            d.cpf.toLowerCase().includes(term)),
      )
      .sort((a, b) => a.completeName.localeCompare(b.completeName) || a.id.localeCompare(b.id));
    return { items: found.slice(offset, offset + limit), total: found.length };
  }

  async findByIds(ids: string[]) {
    return ids.map((id) => this.items.get(id)).filter((d): d is Donor => d !== undefined);
  }

  async create(draft: NewDonor) {
    this.sequence += 1;
    const donor = new Donor({
      ...draft,
      id: `donor-${this.sequence}`,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    this.items.set(donor.id, donor);
    this.saves += 1;
    return donor;
  }

  /** Mesma regra do repositório real: grava só se a versão for a lida, e a incrementa. */
  async save(donor: Donor) {
    const current = this.items.get(donor.id);
    if (current && current !== donor && current.version !== donor.version) {
      throw new ConflictError('O cadastro do doador foi alterado por outra operação.');
    }
    const saved = new Donor({ ...donor, version: donor.version + 1 });
    this.items.set(donor.id, saved);
    this.saves += 1;
    return saved;
  }
}

export class InMemoryUnfitnessRepository implements UnfitnessRepository {
  readonly items: TemporaryUnfitness[] = [];
  private sequence = 0;

  seed(...unfitness: TemporaryUnfitness[]): void {
    this.items.push(...unfitness);
  }

  async create(draft: NewTemporaryUnfitness) {
    this.sequence += 1;
    const unfitness = new TemporaryUnfitness({
      ...draft,
      id: `unfitness-${this.sequence}`,
      createdAt: FIXED_NOW,
    });
    this.items.push(unfitness);
    return unfitness;
  }

  async save(unfitness: TemporaryUnfitness) {
    const i = this.items.findIndex((x) => x.id === unfitness.id);
    if (i >= 0) {
      this.items[i] = unfitness;
    }
    return unfitness;
  }

  async findByIdAndDonor(id: string, donorId: string) {
    return this.items.find((i) => i.id === id && i.donorId === donorId) ?? null;
  }

  async listByDonor(donorId: string) {
    return this.items
      .filter((i) => i.donorId === donorId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }

  async findActive(donorId: string, todayISO: string) {
    return TemporaryUnfitness.mostRestrictive(
      this.items.filter((i) => i.donorId === donorId && i.isActiveAt(todayISO)),
    );
  }

  async listActiveForDonors(donorIds: string[], todayISO: string) {
    return this.items.filter((i) => donorIds.includes(i.donorId) && i.isActiveAt(todayISO));
  }

  async remove(id: string) {
    const i = this.items.findIndex((x) => x.id === id);
    if (i >= 0) this.items.splice(i, 1);
  }

  async replaceReasons(donorId: string, reason: string) {
    for (const i of this.items.filter((x) => x.donorId === donorId)) {
      i.redactReason(reason);
    }
  }
}

export class InMemoryAssessmentRepository implements AssessmentRepository {
  readonly items: EligibilityAssessment[] = [];
  private sequence = 0;

  seed(...assessments: EligibilityAssessment[]): void {
    this.items.push(...assessments);
  }

  async create(draft: NewEligibilityAssessment) {
    this.sequence += 1;
    const assessment = new EligibilityAssessment({
      ...draft,
      id: `assessment-${this.sequence}`,
      assessedAt: FIXED_NOW,
    });
    this.items.push(assessment);
    return assessment;
  }

  async findByAppointment(appointmentId: string, origin: EligibilityAssessment['origin']) {
    return (
      [...this.items]
        .reverse()
        .find((a) => a.appointmentId === appointmentId && a.origin === origin) ?? null
    );
  }

  async listByDonor(donorId: string) {
    return this.items
      .filter((a) => a.donorId === donorId)
      .sort((a, b) => b.assessedAt.getTime() - a.assessedAt.getTime());
  }
}

export class InMemoryAuditRepository implements AuditRepository {
  readonly items: AccessAudit[] = [];
  failOnCreate = false;
  private sequence = 0;

  async create(draft: NewAccessAudit) {
    if (this.failOnCreate) {
      throw new Error('banco indisponível');
    }
    this.sequence += 1;
    const access = new AccessAudit({
      ...draft,
      id: `access-${this.sequence}`,
      createdAt: FIXED_NOW,
    });
    this.items.push(access);
    return access;
  }

  async listByDonor(donorId: string, limit: number) {
    return this.items
      .filter((a) => a.donorId === donorId)
      .reverse()
      .slice(0, limit);
  }
}

export class LoggerInMemory implements LoggerPort {
  readonly errors: string[] = [];

  warn(): void {}

  error(message: string): void {
    this.errors.push(message);
  }
}

/** AuditTrail real sobre o repositório em memória, para conferir o que cada caso de uso auditou. */
export function buildAuditTrail() {
  const accesses = new InMemoryAuditRepository();
  const logger = new LoggerInMemory();
  return { accesses, logger, trail: new AuditTrail(accesses, logger) };
}
