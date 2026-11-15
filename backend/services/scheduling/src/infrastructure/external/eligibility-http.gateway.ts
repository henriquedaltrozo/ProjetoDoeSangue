import type { BloodType } from '@shared/domain/enums';
import type {
  AssessEligibilityInput,
  DonorContactOutput,
  DonorOutput,
  DonorRecipientOutput,
  EligibilityAssessmentOutput,
} from '@shared/application/dto';
import {
  type InternalRequest,
  InternalHttpClient,
  RemoteCallError,
} from '@shared/infrastructure/http';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DependencyUnavailableError } from '../../application/errors';
import type { EligibilityGateway } from '../../application/ports';

/**
 * Chamadas do scheduling-service ao eligibility-service, com a credencial interna do serviço.
 * Qualquer falha do serviço remoto vira DependencyUnavailableError.
 */
@Injectable()
export class EligibilityHttpGateway implements EligibilityGateway {
  private readonly logger = new Logger(EligibilityHttpGateway.name);

  constructor(
    private readonly http: InternalHttpClient,
    private readonly config: ConfigService,
  ) {}

  assessInternal(dto: AssessEligibilityInput): Promise<EligibilityAssessmentOutput> {
    return this.call('avaliar elegibilidade (interno)', {
      method: 'POST',
      url: this.url('/eligibility/internal/assess'),
      data: dto,
      as: 'service',
    });
  }

  completeDonation(donorId: string, donationDate?: string): Promise<DonorOutput> {
    return this.call('registrar doação concluída', {
      method: 'POST',
      url: this.url(`/donors/${donorId}/donations/complete`),
      data: donationDate ? { donationDate } : {},
      as: 'service',
    });
  }

  listContactsByBloodType(bloodType?: BloodType): Promise<DonorContactOutput[]> {
    return this.call('listar contatos de doadores', {
      method: 'GET',
      url: this.url('/donors/internal/contacts'),
      params: bloodType ? { bloodType } : undefined,
      as: 'service',
    });
  }

  async findDonorContact(donorId: string): Promise<DonorRecipientOutput | null> {
    try {
      return await this.http.send<DonorRecipientOutput>({
        method: 'GET',
        url: this.url(`/donors/internal/${donorId}/contact`),
        as: 'service',
      });
    } catch (err) {
      if (err instanceof RemoteCallError && err.status === 404) return null;
      if (!(err instanceof RemoteCallError)) throw err;
      this.logger.error(`Falha ao buscar contato do doador no eligibility-service: ${err.message}`);
      throw new DependencyUnavailableError(
        'Não foi possível concluir a operação com o serviço de elegibilidade (buscar contato do doador).',
      );
    }
  }

  private url(path: string): string {
    return `${this.config.getOrThrow<string>('ELIGIBILITY_SERVICE_URL')}${path}`;
  }

  /** Executa a chamada; falha do serviço remoto vira DependencyUnavailableError, outros erros passam intactos. */
  private async call<T>(action: string, request: InternalRequest): Promise<T> {
    try {
      return await this.http.send<T>(request);
    } catch (err) {
      if (!(err instanceof RemoteCallError)) throw err;
      this.logger.error(`Falha ao ${action} no eligibility-service: ${err.message}`);
      throw new DependencyUnavailableError(
        `Não foi possível concluir a operação com o serviço de elegibilidade (${action}).`,
      );
    }
  }
}
