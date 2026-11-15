import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { IdGenerator } from '../../application/ports/id-generator.port';

@Injectable()
export class UuidIdGenerator implements IdGenerator {
  newId(): string {
    return randomUUID();
  }
}
