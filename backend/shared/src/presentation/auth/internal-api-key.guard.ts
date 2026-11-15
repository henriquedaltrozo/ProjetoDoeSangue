import { timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Protege endpoints internos (chamados só por outro serviço, não pelo
 * frontend via gateway) com uma chave compartilhada simples, enviada no
 * header `x-internal-api-key`. Não substitui JWT para rotas de usuário -
 * é só o suficiente para diferenciar "chamada de outro serviço" de
 * "chamada externa" num projeto acadêmico; em produção real isso seria
 * mTLS ou uma rede interna não exposta.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-internal-api-key'];
    const expected = this.config.getOrThrow<string>('INTERNAL_API_KEY');

    if (typeof provided !== 'string' || !safeEqual(provided, expected)) {
      throw new UnauthorizedException('Chave de serviço interna ausente ou inválida.');
    }
    return true;
  }
}

/** Comparação em tempo constante, para não vazar a chave por diferença de tempo de resposta. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
