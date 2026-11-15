import { InternalHttpClient, RemoteCallError } from '@shared/infrastructure/http';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DependencyUnavailableError } from '../../application/errors/application.errors';
import type { SchedulingGateway } from '../../application/ports/scheduling.gateway';

/** Chamadas do auth-service ao scheduling-service, com a credencial interna. */
@Injectable()
export class SchedulingHttpGateway implements SchedulingGateway {
  private readonly logger = new Logger(SchedulingHttpGateway.name);

  constructor(
    private readonly http: InternalHttpClient,
    private readonly config: ConfigService,
  ) {}

  async cancelOpenAppointments(donorId: string): Promise<void> {
    try {
      await this.http.send<{ canceled: number }>({
        method: 'POST',
        url: `${this.config.getOrThrow<string>('SCHEDULING_SERVICE_URL')}/appointments/internal/donors/${donorId}/cancel-open`,
        as: 'service',
      });
    } catch (err) {
      if (!(err instanceof RemoteCallError)) throw err;
      this.logger.error(`Falha ao chamar o scheduling-service: ${err.message}`);
      throw new DependencyUnavailableError(
        'Não foi possível concluir a exclusão dos seus dados no momento. Tente novamente em instantes.',
      );
    }
  }
}
