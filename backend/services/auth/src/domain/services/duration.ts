const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/**
 * Soma uma duração à data-base. Suporta os sufixos simples usados no .env
 * (30s, 15m, 1h, 7d); sem sufixo, o valor é interpretado como segundos. Um valor em outro formato
 * (ex.: "1w", "7 dias") é erro de configuração: falha aqui em vez de gerar uma data inválida, que
 * faria o refresh token nunca expirar.
 */
export function sumDuration(base: Date, duration: string): Date {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    const seconds = Number(duration || 0);
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error(`Duração inválida: "${duration}" (use, por exemplo, 30s, 15m, 1h ou 7d).`);
    }
    return new Date(base.getTime() + seconds * 1000);
  }
  return new Date(base.getTime() + Number(match[1]) * UNIT_MS[match[2]]);
}
