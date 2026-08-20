const EMAIL_KEY = 'userEmail';
const USER_ID_KEY = 'showdown.userId';

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
