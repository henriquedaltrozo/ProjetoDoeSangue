import { openJson } from '@shared/infrastructure/persistence';
import { Injectable } from '@nestjs/common';
import type { JobPayloadOpener } from '../../application/ports/job-payload-opener.port';

/** Abre o corpo cifrado dos jobs (ver `sealJson`, usado pelos publicadores). */
@Injectable()
export class SealedJobPayloadOpener implements JobPayloadOpener {
  open<T>(data: unknown): T {
    return openJson<T>(data);
  }
}
