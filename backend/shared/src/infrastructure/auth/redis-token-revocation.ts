import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { TokenRevocation } from '../../application/auth';

/**
 * Por quanto tempo a revogação fica guardada: precisa cobrir a validade do token de acesso
 * (JWT_ACCESS_EXPIRES_IN, 15 min por padrão); um dia dá folga para qualquer configuração razoável.
 */
const REVOCATION_TTL_SECONDS = 24 * 60 * 60;

/**
 * Revogações no Redis (compartilhado pelos serviços), uma chave por usuário. Se o Redis estiver fora
 * do ar, a checagem deixa passar (registrando aviso): a autenticação não pode depender do Redis, e
 * nesse caso o token só vale até expirar, como antes. A gravação também não derruba a operação que
 * a pediu (a conta já foi desativada; só a janela de 15 min continua).
 */
@Injectable()
export class RedisTokenRevocation implements TokenRevocation, OnModuleDestroy {
  private readonly logger = new Logger(RedisTokenRevocation.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 1000, 30_000),
      enableOfflineQueue: false,
    });
    this.client.on('error', (err) => this.logger.warn(`Redis indisponível: ${err.message}`));
    this.client.connect().catch(() => undefined);
  }

  private key(userId: string): string {
    return `auth:revoked:${userId}`;
  }

  async revokeUser(userId: string, at: Date): Promise<void> {
    try {
      const seconds = Math.floor(at.getTime() / 1000);
      await this.client.set(this.key(userId), String(seconds), 'EX', REVOCATION_TTL_SECONDS);
    } catch (err) {
      this.logger.error(
        `Falha ao revogar os tokens do usuário ${userId}: ${(err as Error).message}`,
      );
    }
  }

  async revokedAtSeconds(userId: string): Promise<number | null> {
    try {
      const raw = await this.client.get(this.key(userId));
      return raw ? Number(raw) : null;
    } catch (err) {
      this.logger.warn(
        `Falha ao consultar revogação (usuário ${userId}): ${(err as Error).message}`,
      );
      return null;
    }
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
