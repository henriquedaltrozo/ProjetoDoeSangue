import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthSettings } from '../../application/ports/auth-settings.port';

/** Lê as variáveis de ambiente a cada acesso (mesma semântica do ConfigService). */
@Injectable()
export class ConfigAuthSettings implements AuthSettings {
  constructor(private readonly config: ConfigService) {}

  get refreshTokenExpiresAt(): string {
    return this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
  }

  get frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
  }

  get smtpConfigured(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST'));
  }

  get production(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }
}
