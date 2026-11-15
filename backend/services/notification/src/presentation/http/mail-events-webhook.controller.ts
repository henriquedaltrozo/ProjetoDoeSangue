import { createHash, timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type MailEvent,
  RegisterMailEventsUseCase,
} from '../../application/use-cases/register-mail-events.use-case';

/**
 * Webhook do provedor de e-mail (ex.: Brevo, em Transactional > Settings > Webhook): recebe os
 * eventos de devolução e de spam para bloquear esses endereços. Público (o provedor não tem JWT),
 * protegido pelo segredo MAIL_WEBHOOK_SECRET na URL (`?token=`). Sem o segredo configurado, a rota
 * não existe (404).
 */
@ApiTags('notifications')
@Controller('notifications/webhooks')
export class MailEventsWebhookController {
  constructor(
    private readonly registerEvents: RegisterMailEventsUseCase,
    private readonly config: ConfigService,
  ) {}

  // Pública: limitada por IP. O provedor manda muitos eventos de poucos IPs, então o limite é folgado
  // (300/min); o segredo na URL é o que protege de verdade.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @Post('mail')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[provedor] Eventos de e-mail (hard_bounce, invalid_email, blocked, spam): bloqueia o endereço',
  })
  async mail(@Query('token') token: string | undefined, @Body() body: unknown) {
    const expected = this.config.get<string>('MAIL_WEBHOOK_SECRET');
    if (!expected) throw new NotFoundException();
    const hash = (v: string) => createHash('sha256').update(v).digest();
    if (!token || !timingSafeEqual(hash(token), hash(expected))) {
      throw new ForbiddenException('Token do webhook inválido.');
    }
    const suppressed = await this.registerEvents.execute(parseEvents(body));
    return { suppressed };
  }
}

/** Aceita um evento ou uma lista; ignora o que não tem `event` e `email` em texto. */
export function parseEvents(body: unknown): MailEvent[] {
  const list = Array.isArray(body) ? body : [body];
  return list.flatMap((item) => {
    const record = item as Record<string, unknown> | null;
    return record && typeof record.event === 'string' && typeof record.email === 'string'
      ? [{ event: record.event, email: record.email }]
      : [];
  });
}
