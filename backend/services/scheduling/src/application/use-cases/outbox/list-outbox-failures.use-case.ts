import { type OutboxEventOutput, toOutboxEventOutput } from '../../dto';
import { OUTBOX_REPOSITORY, OutboxRepository } from '../../ports';

const FAILURES_LISTED_LIMIT = 200;

/** [admin] Lista os eventos do outbox que esgotaram as tentativas. */
export class ListOutboxFailuresUseCase {
  static readonly inject = [OUTBOX_REPOSITORY] as const;

  constructor(private readonly outbox: OutboxRepository) {}

  async execute(): Promise<OutboxEventOutput[]> {
    return (await this.outbox.listFailures(FAILURES_LISTED_LIMIT)).map(toOutboxEventOutput);
  }
}
