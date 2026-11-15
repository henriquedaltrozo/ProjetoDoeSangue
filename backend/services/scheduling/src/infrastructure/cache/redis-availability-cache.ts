import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AvailabilityCache } from '../../application/ports';
import { AvailabilityQuery } from '../../domain/appointment';
import { toBusinessDate } from '@shared/domain/time';

/**
 * Cache-aside simples sobre Redis para os horários disponíveis (ver stack,
 * item 7: "Redis - cache de horários disponíveis"). Degrada graciosamente:
 * se o Redis estiver fora do ar (ex: rodando local sem docker-compose
 * ainda), as chamadas viram no-op em vez de derrubar a aplicação - o
 * PostgreSQL continua sendo a fonte de verdade em qualquer cenário.
 */
@Injectable()
export class RedisAvailabilityCache implements AvailabilityCache, OnModuleDestroy {
  private readonly logger = new Logger(RedisAvailabilityCache.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      // Reconecta em segundo plano (até a cada 30 s): sem isso, uma queda do Redis desligaria o
      // cache até reiniciar o serviço. Enquanto estiver desconectado, os comandos falham na hora
      // (sem fila offline) e o caso de uso segue direto no banco.
      retryStrategy: (times) => Math.min(times * 1000, 30_000),
      enableOfflineQueue: false,
    });
    this.client.on('error', (err) => this.logger.warn(`Redis indisponível: ${err.message}`));
    this.client.connect().catch(() => undefined);
  }

  private key(collectionUnitId: string, dataISO: string): string {
    return `availability:${collectionUnitId}:${dataISO}`;
  }

  async get(collectionUnitId: string, dataISO: string): Promise<AvailabilityQuery | null> {
    const key = this.key(collectionUnitId, dataISO);
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as AvailabilityQuery) : null;
    } catch (err) {
      this.logger.warn(`Falha ao ler cache (${key}): ${(err as Error).message}`);
      return null;
    }
  }

  async store(
    collectionUnitId: string,
    dataISO: string,
    query: AvailabilityQuery,
    ttlSeconds: number,
  ): Promise<void> {
    const key = this.key(collectionUnitId, dataISO);
    try {
      await this.client.set(key, JSON.stringify(query), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Falha ao gravar cache (${key}): ${(err as Error).message}`);
    }
  }

  async invalidateDay(collectionUnitId: string, dateTime: Date): Promise<void> {
    // Mesma chave que a consulta usa: o dia de calendário em Brasília.
    const key = this.key(collectionUnitId, toBusinessDate(dateTime));
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.warn(`Falha ao invalidar cache (${key}): ${(err as Error).message}`);
    }
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
