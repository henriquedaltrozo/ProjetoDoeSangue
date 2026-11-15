import { plainToInstance } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Min, validateSync } from 'class-validator';
import { assertProductionSecrets } from './production-secrets';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Superset de variaveis de ambiente usadas por qualquer servico do backend.
 * Cada servico so precisa preencher as que de fato usa - todas sao
 * opcionais aqui; a leitura via ConfigService#getOrThrow no ponto de uso
 * garante que a ausencia de uma variavel obrigatoria para aquele serviço
 * falhe cedo, no bootstrap.
 */
export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(NodeEnv)
  NODE_ENV?: NodeEnv;

  /** Força o Swagger (/docs) ligado ou desligado; sem valor, só liga fora de produção. */
  @IsOptional()
  @IsIn(['true', 'false'])
  SWAGGER_ENABLED?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  PORT?: number;

  @IsOptional()
  @IsString()
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  DB_HOST?: string;

  @IsOptional()
  @IsInt()
  DB_PORT?: number;

  @IsOptional()
  @IsString()
  DB_USERNAME?: string;

  @IsOptional()
  @IsString()
  DB_PASSWORD?: string;

  @IsOptional()
  @IsString()
  DB_DATABASE?: string;

  /** 'true' troca as migrations pelo `synchronize` do TypeORM (só para experimentar localmente). */
  @IsOptional()
  @IsIn(['true', 'false'])
  DB_SYNCHRONIZE?: string;

  @IsOptional()
  @IsString()
  REDIS_HOST?: string;

  @IsOptional()
  @IsInt()
  REDIS_PORT?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  NOTIFICATION_SERVICE_PORT?: number;

  @IsOptional()
  @IsString()
  AUTH_SERVICE_URL?: string;

  @IsOptional()
  @IsString()
  ELIGIBILITY_SERVICE_URL?: string;

  @IsOptional()
  @IsString()
  SCHEDULING_SERVICE_URL?: string;

  @IsOptional()
  @IsString()
  INTERNAL_API_KEY?: string;

  /** Chave usada para cifrar colunas sensíveis em repouso (ver encryptedColumn em shared-config). */
  @IsOptional()
  @IsString()
  DATA_ENCRYPTION_KEY?: string;

  /**
   * Envio real de e-mail (notification-service) - ver MailService. Quando
   * SMTP_HOST não está definido, o envio continua simulado (só loga), como
   * sempre foi neste projeto; funciona com qualquer provedor que exponha
   * endpoint SMTP (SendGrid, SES, Gmail, Mailtrap, ...), sem SDK específico.
   */
  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  SMTP_PORT?: number;

  /** String 'true'/'false' de propósito (não @IsBoolean/coerção implícita) - ver MailService. */
  @IsOptional()
  @IsString()
  SMTP_SECURE?: string;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM?: string;

  /** Segredo do webhook de eventos do provedor de e-mail (`?token=`). Sem ele, o webhook fica desligado. */
  @IsOptional()
  @IsString()
  MAIL_WEBHOOK_SECRET?: string;

  /** Máximo de e-mails por segundo que o notification-service envia (limite do provedor). Padrão: 5. */
  @IsOptional()
  @IsInt()
  @Min(1)
  MAIL_RATE_PER_SECOND?: number;

  /** Origens do front permitidas no CORS (lista separada por vírgulas). Padrão: FRONTEND_URL. */
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  /** Quantos proxies confiáveis estão na frente do serviço (define `trust proxy`). */
  @IsOptional()
  @IsInt()
  @Min(0)
  TRUST_PROXY_HOPS?: number;

  /** Token exigido (header `x-setup-token`) para criar o primeiro admin. Sem ele, o bootstrap fica fechado. */
  @IsOptional()
  @IsString()
  ADMIN_SETUP_TOKEN?: string;

  /** Cookie do refresh token: 'true'/'false' (padrão: true em produção) e SameSite (strict|lax|none). */
  @IsOptional()
  @IsString()
  COOKIE_SECURE?: string;

  @IsOptional()
  @IsString()
  COOKIE_SAMESITE?: string;

  /** URL pública da API (o gateway), usada no link de descadastro de um clique dos e-mails. */
  @IsOptional()
  @IsString()
  PUBLIC_API_URL?: string;

  /** Base do front, usada pelo auth-service para montar o link de redefinição de senha. */
  @IsOptional()
  @IsString()
  FRONTEND_URL?: string;

  /** Só para rodar localmente: aceita segredos de exemplo em produção, com aviso (ver production-secrets.ts). */
  @IsOptional()
  @IsIn(['true', 'false'])
  ALLOW_INSECURE_DEFAULT_SECRETS?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: true });
  if (errors.length > 0) {
    throw new Error(`Configuração de ambiente inválida: ${errors.toString()}`);
  }
  assertProductionSecrets(config);
  return validated;
}
