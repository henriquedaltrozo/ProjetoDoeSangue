import { openJson, sealJson } from '@shared/infrastructure/persistence';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  AccountNoticeOutbox,
  AccountNoticePayload,
  PendingAccountNotice,
} from '../../../application/ports/account-notice-outbox';
import { AccountNoticeOrmEntity } from '../orm-entities/account-notice.orm-entity';

@Injectable()
export class AccountNoticeTypeOrmRepository implements AccountNoticeOutbox {
  constructor(
    @InjectRepository(AccountNoticeOrmEntity)
    private readonly repo: Repository<AccountNoticeOrmEntity>,
  ) {}

  async add(payload: AccountNoticePayload): Promise<void> {
    // O corpo leva nome, e-mail e links com token: fica cifrado até o envio.
    await this.repo.insert({ payload: { ...sealJson(payload) } });
  }

  async claimDue(limit: number, leaseUntil: Date): Promise<PendingAccountNotice[]> {
    // Um único comando: seleciona e trava (SKIP LOCKED) e já adia o vencimento; o commit é imediato.
    const output = await this.repo.query(
      `UPDATE "auth"."account_notices" SET "nextAttemptAt" = $1
        WHERE id IN (
          SELECT id FROM "auth"."account_notices"
           WHERE "nextAttemptAt" <= now()
           ORDER BY "createdAt" ASC
           LIMIT $2
           FOR UPDATE SKIP LOCKED)
        RETURNING id, payload, attempts, "createdAt"`,
      [leaseUntil, limit],
    );
    // No Postgres, o TypeORM devolve [linhas, quantidade] para UPDATE.
    const rows = (Array.isArray(output[0]) ? output[0] : output) as Array<{
      id: string;
      payload: AccountNoticePayload;
      attempts: number;
      createdAt: Date;
    }>;
    return rows
      .map((row) => ({
        ...row,
        payload: openJson<AccountNoticePayload>(row.payload),
        createdAt: new Date(row.createdAt),
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async reschedule(
    id: string,
    attempts: number,
    nextAttemptAt: Date,
    lastError: string,
  ): Promise<void> {
    await this.repo.update({ id }, { attempts, nextAttemptAt, lastError });
  }
}
