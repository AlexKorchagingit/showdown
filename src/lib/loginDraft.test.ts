import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAgreementsAt,
  clearTempAuth,
  clearVerifiedEmail,
  readAgreementsAt,
  readTempAuthValue,
  readVerifiedEmail,
  savePendingEmail,
  saveTempAuth,
  writeAgreementsAt,
  writeVerifiedEmail,
} from './loginDraft';

const blockedStorage = {
  get length(): number { throw new DOMException('Blocked', 'SecurityError'); },
  getItem(): string | null { throw new DOMException('Blocked', 'SecurityError'); },
  setItem(): void { throw new DOMException('Blocked', 'SecurityError'); },
  removeItem(): void { throw new DOMException('Blocked', 'SecurityError'); },
  key(): string | null { throw new DOMException('Blocked', 'SecurityError'); },
};

describe('login draft storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', blockedStorage);
    clearTempAuth();
    clearAgreementsAt();
  });

  afterEach(() => {
    clearTempAuth();
    clearAgreementsAt();
    vi.unstubAllGlobals();
  });

  it('does not turn a successful OTP request into a storage error', () => {
    expect(() => saveTempAuth(' Member@Example.test ', 60)).not.toThrow();

    expect(readTempAuthValue('temp_auth_email')).toBe('member@example.test');
    expect(readTempAuthValue('temp_auth_step')).toBe('code');
    expect(Number(readTempAuthValue('temp_auth_expire'))).toBeGreaterThan(Date.now());
  });

  it('keeps consent and pending email usable in memory', () => {
    const acceptedAt = new Date().toISOString();

    expect(() => writeAgreementsAt(acceptedAt)).not.toThrow();
    expect(() => savePendingEmail('New@Example.test', 'consent')).not.toThrow();

    expect(readAgreementsAt()).toBe(acceptedAt);
    expect(readTempAuthValue('temp_auth_email')).toBe('new@example.test');
    expect(readTempAuthValue('temp_auth_step')).toBe('consent');
  });

  it('remembers the verified email so the consent step is not sent back for a new code', () => {
    writeVerifiedEmail(' New@Example.test ');
    savePendingEmail('New@Example.test', 'consent');

    expect(readVerifiedEmail()).toBe('new@example.test');
  });

  it('forgets the verified email when the login draft is dropped', () => {
    writeVerifiedEmail('new@example.test');

    clearVerifiedEmail();
    expect(readVerifiedEmail()).toBe('');

    writeVerifiedEmail('new@example.test');
    clearTempAuth();
    expect(readVerifiedEmail()).toBe('');
  });
});
