import { Body, Controller, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UnsubscribeAlertsUseCase } from '../../../application/use-cases/unsubscribe-alerts.use-case';

/**
 * Descadastro dos avisos por e-mail (campanhas e "já pode doar"), público: quem prova o direito é o
 * token assinado do link. Atende os dois caminhos:
 * - a página /unsubscribe do front, que envia `{ token }` no corpo;
 * - o botão "cancelar inscrição" do Gmail/Outlook (cabeçalho List-Unsubscribe, RFC 8058), que faz
 *   POST com o token na URL e o corpo `List-Unsubscribe=One-Click`.
 */
@ApiTags('donors')
@Controller('donors/alerts')
export class AlertsUnsubscribeController {
  constructor(private readonly unsubscribe: UnsubscribeAlertsUseCase) {}

  // Pública: limitada a 20 requisições / 15 min por IP (o token já protege; isto evita abuso).
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  @Post('unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      '[público, por token] Desliga os avisos de campanhas e de "já pode doar" do doador do link',
  })
  async execute(
    @Query('token') queryToken: string | undefined,
    @Body() body: Record<string, unknown> | undefined,
  ): Promise<void> {
    const bodyToken = typeof body?.token === 'string' ? body.token : undefined;
    await this.unsubscribe.execute(queryToken ?? bodyToken);
  }
}
