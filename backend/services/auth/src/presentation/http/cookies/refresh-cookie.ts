import { readCookie, allowedOrigin, allowedOrigins } from '@shared/presentation/http';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

export const REFRESH_COOKIE = 'doesangue_rt';
/** O cookie só é enviado às rotas /auth (refresh e logout): não viaja nas demais requisições. */
const COOKIE_PATH = '/auth';

type SameSite = 'strict' | 'lax' | 'none';

function sameSite(config: ConfigService): SameSite {
  const v = (config.get<string>('COOKIE_SAMESITE') ?? 'strict').toLowerCase();
  return v === 'lax' || v === 'none' ? v : 'strict';
}

function secure(config: ConfigService): boolean {
  const v = config.get<string>('COOKIE_SECURE');
  if (v !== undefined && v !== '') return v === 'true';
  return config.get<string>('NODE_ENV') === 'production';
}

/** Grava o refresh token num cookie httpOnly (inacessível a JavaScript, mitiga roubo por XSS). */
export function writeRefreshCookie(
  res: Response,
  config: ConfigService,
  refreshToken: string,
  expiresAt: Date,
): void {
  const mode = sameSite(config);
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: secure(config) || mode === 'none',
    sameSite: mode,
    path: COOKIE_PATH,
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res: Response, config: ConfigService): void {
  const mode = sameSite(config);
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: secure(config) || mode === 'none',
    sameSite: mode,
    path: COOKIE_PATH,
  });
}

export function readRefreshCookie(req: Request): string | undefined {
  return readCookie(req.headers.cookie, REFRESH_COOKIE);
}

/**
 * Defesa extra contra CSRF nas rotas que usam o cookie: se a requisição vem de um navegador
 * (tem `Origin`), a origem precisa estar na lista do CORS.
 */
export function requireAllowedOrigin(req: Request, config: ConfigService): void {
  const origin = req.headers.origin as string | undefined;
  if (!allowedOrigin(origin, allowedOrigins(config))) {
    throw new ForbiddenException('Origem não permitida.');
  }
}
