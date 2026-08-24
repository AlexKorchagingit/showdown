import { clearUserData } from './userStorage';

const EMAIL_KEY = 'userEmail';
const USER_ID_KEY = 'showdown.userId';

export const TEMP_AUTH_KEYS = [
  'temp_auth_email',
  'temp_auth_code',
  'temp_auth_step',
  'temp_auth_expire',
  'temp_auth_agreements_at',
] as const;

export function readSessionEmail(): string {
  try {
    return localStorage.getItem(EMAIL_KEY) || '';
  } catch {
    return '';
  }
}

export function readSessionUserId(): string {
  try {
    return localStorage.getItem(USER_ID_KEY) || '';
  } catch {
    return '';
  }
}

export function writeSession(email: string, userId: string) {
  try {
    localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
    if (userId) localStorage.setItem(USER_ID_KEY, userId);
  } catch {
    /* quota */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(USER_ID_KEY);
  } catch {
    /* ignore */
  }
}

function clearTempAuthDraft() {
  try {
    TEMP_AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

/** Wipe the local login so the next screen is registration, not an empty profile. */
export function endLocalSession(email?: string) {
  const storedEmail = (email || readSessionEmail()).trim().toLowerCase();
  clearSession();
  clearTempAuthDraft();
  if (storedEmail) clearUserData(storedEmail);
}
