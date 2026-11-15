import { type OutboxEventOutput, toOutboxEventOutput } from '../../dto';
import { NotFoundError } from '../../errors';
import { CLOCK, Clock, OUTBOX_REPOSITORY, OutboxRepository } from '../../ports';

/** [admin] Devolve um evento em FAILURE para a fila (zera as tentativas). */
export class ReprocessEventOutboxUseCase {
  static readonly inject = [OUTBOX_REPOSITORY, CLOCK] as const;

  constructor(
    private readonly outbox: OutboxRepository,
    private readonly clock: Clock,
  ) {}

  async execute(id: string): Promise<OutboxEventOutput> {
    const event = await this.outbox.findFailureById(id);
    if (!event) {
      throw new NotFoundError('Evento não encontrado ou não está em FAILURE.');
    }
    event.reprocess(this.clock.now());
    return toOutboxEventOutput(await this.outbox.save(event));
  }
}
