import {
  PasswordResetToken,
  RESET_TOKEN_EXPIRES_IN_MINUTES,
} from '@src/domain/entities/password-reset-token';
import { RefreshToken } from '@src/domain/entities/refresh-token';

const now = new Date('2026-01-01T12:00:00.000Z');

describe('RefreshToken', () => {
  const issue = () =>
    RefreshToken.issue({ id: 't', userId: 'u', tokenHash: 'h', now, validity: '7d' });

  it('emite com validade calculada e não revogado', () => {
    const t = issue();
    expect(t.expiresAt.getTime()).toBe(now.getTime() + 7 * 86_400_000);
    expect(t.revokedAt).toBeNull();
  });

  it('é válido até expirar (expirar exatamente no instante ainda vale)', () => {
    const t = issue();
    expect(t.isValid(now)).toBe(true);
    expect(t.isValid(t.expiresAt)).toBe(true);
    expect(t.isValid(new Date(t.expiresAt.getTime() + 1))).toBe(false);
  });

  it('deixa de ser válido depois de revogado', () => {
    const t = issue();
    t.revoke(now);
    expect(t.isValid(now)).toBe(false);
  });
});

describe('PasswordResetToken', () => {
  const issue = () => PasswordResetToken.issue({ id: 'r', userId: 'u', tokenHash: 'h', now });

  it('expira em 15 minutos', () => {
    expect(RESET_TOKEN_EXPIRES_IN_MINUTES).toBe(15);
    expect(issue().expiresAt.getTime()).toBe(now.getTime() + 15 * 60_000);
  });

  it('é utilizável uma única vez e só dentro da validade', () => {
    const t = issue();
    expect(t.isValid(now)).toBe(true);
    expect(t.isValid(new Date(now.getTime() + 16 * 60_000))).toBe(false);
    t.markAsUsed(now);
    expect(t.isValid(now)).toBe(false);
  });
});
