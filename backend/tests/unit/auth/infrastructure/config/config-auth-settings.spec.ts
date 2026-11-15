import { ConfigAuthSettings } from '@src/infrastructure/config/config-auth-settings';

function settings(values: Record<string, string>) {
  const config = { get: (key: string, fallback?: string) => values[key] ?? fallback };
  return new ConfigAuthSettings(config as never);
}

describe('ConfigAuthSettings', () => {
  it('usa os padrões quando as variáveis não existem', () => {
    const s = settings({});
    expect(s.refreshTokenExpiresAt).toBe('7d');
    expect(s.frontendUrl).toBe('http://localhost:5173');
    expect(s.smtpConfigured).toBe(false);
    expect(s.production).toBe(false);
  });

  it('lê as variáveis de ambiente e detecta SMTP configurado', () => {
    const s = settings({
      JWT_REFRESH_EXPIRES_IN: '1d',
      FRONTEND_URL: 'https://app.test',
      SMTP_HOST: 'smtp.test',
    });
    expect(s.refreshTokenExpiresAt).toBe('1d');
    expect(s.frontendUrl).toBe('https://app.test');
    expect(s.smtpConfigured).toBe(true);
  });

  it('detecta produção pelo NODE_ENV', () => {
    expect(settings({ NODE_ENV: 'production' }).production).toBe(true);
    expect(settings({ NODE_ENV: 'development' }).production).toBe(false);
  });
});
