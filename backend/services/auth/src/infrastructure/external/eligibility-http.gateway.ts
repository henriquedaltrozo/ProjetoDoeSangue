import type {
  CreateDonorInput,
  DonorOutput,
  UpdateDonorIdentityInput,
} from '@shared/application/dto';
import { InternalHttpClient, RemoteCallError } from '@shared/infrastructure/http';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConflictError,
  DependencyUnavailableError,
  InvalidEntryError,
} from '../../application/errors/application.errors';
import type { EligibilityGateway, NewDonor } from '../../application/ports/eligibility.gateway';

/**
 * Chamadas do auth-service ao eligibility-service (cadastro e exclusão de conta), todas com a
 * credencial interna. Falhas do serviço remoto viram erros da aplicação do auth.
 */
@Injectable()
export class EligibilityHttpGateway implements EligibilityGateway {
  private readonly logger = new Logger(EligibilityHttpGateway.name);

  constructor(
    private readonly http: InternalHttpClient,
    private readonly config: ConfigService,
  ) {}

  async createDonor(donor: NewDonor): Promise<{ id: string }> {
    const body: CreateDonorInput = donor;
    try {
      const created = await this.http.send<DonorOutput>({
        method: 'POST',
        url: this.url('/donors'),
        data: body,
        as: 'service',
      });
      return { id: created.id };
    } catch (err) {
      if (err instanceof RemoteCallError && err.status === 409) {
        throw new ConflictError(err.remoteMessage ?? 'CPF já cadastrado.');
      }
      // Dados recusados pelo eligibility (ex.: menor sem o responsável informado): a mensagem dele
      // diz ao usuário o que corrigir.
      if (err instanceof RemoteCallError && err.status === 400) {
        throw new InvalidEntryError(err.remoteMessage ?? 'Dados do cadastro inválidos.');
      }
      throw this.unavailable(
        err,
        'Não foi possível concluir o cadastro no momento. Tente novamente em instantes.',
      );
    }
  }

  /**
   * Id do Donor de um User, ou `null` se ainda não existe (404). Usado para resolver um cadastro
   * de resultado incerto (a resposta de `createDonor` se perdeu).
   */
  async findDonorIdByUser(userId: string): Promise<string | null> {
    try {
      const { id } = await this.http.send<{ id: string }>({
        method: 'GET',
        url: this.url(`/donors/internal/by-user/${userId}`),
        as: 'service',
      });
      return id;
    } catch (err) {
      if (err instanceof RemoteCallError && err.status === 404) return null;
      throw this.unavailable(
        err,
        'Não foi possível concluir a operação com o serviço de elegibilidade (consultar doador por usuário).',
      );
    }
  }

  /** [LGPD] Anonimiza os dados identificantes do Donor (parte da exclusão de conta). */
  async anonymizeDonor(donorId: string): Promise<void> {
    try {
      await this.http.send<void>({
        method: 'POST',
        url: this.url(`/donors/${donorId}/anonymize`),
        as: 'service',
      });
    } catch (err) {
      throw this.unavailable(
        err,
        'Não foi possível concluir a exclusão dos seus dados no momento. Tente novamente em instantes.',
      );
    }
  }

  async updateDonorIdentity(donorId: string, data: UpdateDonorIdentityInput): Promise<void> {
    try {
      await this.http.send<DonorOutput>({
        method: 'PATCH',
        url: this.url(`/donors/internal/${donorId}/identity`),
        data,
        as: 'service',
      });
    } catch (err) {
      if (err instanceof RemoteCallError && err.status === 409) {
        throw new ConflictError(
          err.remoteMessage ?? 'Seus dados foram alterados por outra operação. Tente de novo.',
        );
      }
      if (err instanceof RemoteCallError && err.status === 400) {
        throw new InvalidEntryError(err.remoteMessage ?? 'Dados inválidos.');
      }
      throw this.unavailable(
        err,
        'Não foi possível atualizar seus dados no momento. Tente novamente em instantes.',
      );
    }
  }

  private url(path: string): string {
    return `${this.config.getOrThrow<string>('ELIGIBILITY_SERVICE_URL')}${path}`;
  }

  /** Falha do serviço remoto vira DependencyUnavailableError; outros erros passam intactos. */
  private unavailable(err: unknown, message: string): unknown {
    if (!(err instanceof RemoteCallError)) return err;
    this.logger.error(`Falha ao chamar o eligibility-service: ${err.message}`);
    return new DependencyUnavailableError(message);
  }
}
