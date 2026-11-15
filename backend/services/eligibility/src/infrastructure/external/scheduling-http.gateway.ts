import { InternalHttpClient } from '@shared/infrastructure/http';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SchedulingGateway } from '../../application/ports/scheduling.gateway';

/**
 * Quantos doadores cada chamada leva: a rota interna aceita até 5000, e um dia com mais candidatos
 * do que isso não pode travar a rotina inteira.
 */
export const DONOR_IDS_PER_CALL = 1000;

/** Chamadas do eligibility-service ao scheduling-service, com a credencial interna. */
@Injectable()
export class SchedulingHttpGateway implements SchedulingGateway {
  constructor(
    private readonly http: InternalHttpClient,
    private readonly config: ConfigService,
  ) {}

  async donorsWithOpenAppointment(donorIds: string[]): Promise<string[]> {
    const url = `${this.config.getOrThrow<string>('SCHEDULING_SERVICE_URL')}/appointments/internal/donors-with-open-appointment`;
    const open: string[] = [];
    for (let i = 0; i < donorIds.length; i += DONOR_IDS_PER_CALL) {
      const { donorIds: batch } = await this.http.send<{ donorIds: string[] }>({
        method: 'POST',
        url,
        data: { donorIds: donorIds.slice(i, i + DONOR_IDS_PER_CALL) },
        as: 'service',
      });
      open.push(...batch);
    }
    return open;
  }
}
