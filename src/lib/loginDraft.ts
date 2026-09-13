import { safeLocalStorage } from './safeStorage';

export const AGREEMENTS_KEY = 'temp_auth_agreements_at';

export const TEMP_AUTH_KEYS = [
  'temp_auth_email',
  'temp_auth_code',
  'temp_auth_step',
  'temp_auth_expire',
  'temp_auth_verified',
] as const;

const VERIFIED_KEY = 'temp_auth_verified';

export function readTempAuthValue(key: string): string {
  return safeLocalStorage.getItem(key) ?? '';
}

export function readTempAuthStep(): string | null {
  return readTempAuthValue('temp_auth_step') || null;
}

export function readAgreementsAt(): string {
  return safeLocalStorage.getItem(AGREEMENTS_KEY) ?? '';
}

export function writeAgreementsAt(iso: string): void {
  safeLocalStorage.setItem(AGREEMENTS_KEY, iso);
}

export function clearAgreementsAt(): void {
  safeLocalStorage.removeItem(AGREEMENTS_KEY);
}

export function clearTempAuth(): void {
  TEMP_AUTH_KEYS.forEach((key) => safeLocalStorage.removeItem(key));
}

export function saveTempAuth(targetEmail: string, timerSeconds: number): void {
  safeLocalStorage.setItem('temp_auth_email', targetEmail.trim().toLowerCase());
  safeLocalStorage.removeItem('temp_auth_code');
  safeLocalStorage.setItem('temp_auth_step', 'code');
  safeLocalStorage.setItem(
    'temp_auth_expire',
    (Date.now() + timerSeconds * 1000).toString(),
  );
}

export function savePendingEmail(targetEmail: string, step: 'email' | 'consent'): void {
  safeLocalStorage.setItem('temp_auth_email', targetEmail.trim().toLowerCase());
  safeLocalStorage.setItem('temp_auth_step', step);
  safeLocalStorage.removeItem('temp_auth_code');
  safeLocalStorage.removeItem('temp_auth_expire');
}

/**
 * The code step is behind us once the email is verified. Telegram reloads the
 * mini app whenever it feels like it, and the consent screen must not send the
 * user back for another code just because a React ref was lost.
 */
export function writeVerifiedEmail(targetEmail: string): void {
  safeLocalStorage.setItem(VERIFIED_KEY, targetEmail.trim().toLowerCase());
}

export function readVerifiedEmail(): string {
  return readTempAuthValue(VERIFIED_KEY).trim().toLowerCase();
}

export function clearVerifiedEmail(): void {
  safeLocalStorage.removeItem(VERIFIED_KEY);
}
