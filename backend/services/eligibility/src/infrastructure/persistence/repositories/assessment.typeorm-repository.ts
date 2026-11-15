import type { AssessmentSource } from '@shared/domain/enums';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AssessmentRepository } from '../../../application/ports/assessment.repository';
import type {
  EligibilityAssessment,
  NewEligibilityAssessment,
} from '../../../domain/entities/assessment-eligibility';
import { EligibilityAssessmentMapper } from '../mappers/assessment-eligibility.mapper';
import { EligibilityAssessmentOrmEntity } from '../orm-entities/assessment-eligibility.orm-entity';

@Injectable()
export class AssessmentTypeOrmRepository implements AssessmentRepository {
  constructor(
    @InjectRepository(EligibilityAssessmentOrmEntity)
    private readonly repo: Repository<EligibilityAssessmentOrmEntity>,
  ) {}

  async create(draft: NewEligibilityAssessment): Promise<EligibilityAssessment> {
    const saved = await this.repo.save(this.repo.create(draft));
    return EligibilityAssessmentMapper.toDomain(saved);
  }

  async findByAppointment(
    appointmentId: string,
    origin: AssessmentSource,
  ): Promise<EligibilityAssessment | null> {
    const orm = await this.repo.findOne({
      where: { appointmentId, origin },
      order: { assessedAt: 'DESC' },
    });
    return orm ? EligibilityAssessmentMapper.toDomain(orm) : null;
  }

  async listByDonor(donorId: string): Promise<EligibilityAssessment[]> {
    const list = await this.repo.find({ where: { donorId }, order: { assessedAt: 'DESC' } });
    return list.map(EligibilityAssessmentMapper.toDomain);
  }
}
