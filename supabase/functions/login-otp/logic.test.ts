import { describe, expect, it } from 'vitest';
import { codeFromRandomBytes, isAllowedOrigin, normalizeCode, normalizeEmail } from './logic';

describe('login OTP server validation', () => {
  it('normalizes a valid email and rejects malformed input', () => {
    expect(normalizeEmail(' User@Example.com ')).toBe('user@example.com');
    expect(normalizeEmail('not-an-email')).toBeNull();
    expect(normalizeEmail('a'.repeat(255) + '@example.com')).toBeNull();
  });

  it('accepts only four decimal digits', () => {
    expect(normalizeCode(' 0123 ')).toBe('0123');
    expect(normalizeCode('12345')).toBeNull();
    expect(normalizeCode('12a3')).toBeNull();
  });

  it('creates a zero-padded four-digit code from random bytes', () => {
    expect(codeFromRandomBytes(new Uint8Array([0, 0, 0, 7]))).toBe('0007');
    expect(codeFromRandomBytes(new Uint8Array([0, 0, 39, 15]))).toBe('9999');
  });

  it('allows only an exact configured origin', () => {
    const allowed = ['https://showdown-br.ru'];
    expect(isAllowedOrigin('https://showdown-br.ru', allowed)).toBe(true);
    expect(isAllowedOrigin('https://showdown-br.ru.evil.test', allowed)).toBe(false);
    expect(isAllowedOrigin(null, allowed)).toBe(false);
  });
});
