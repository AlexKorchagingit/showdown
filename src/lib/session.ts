import { clearUserData } from './userStorage';
import { supabase } from './supabase';
import { safeLocalStorage } from './safeStorage';

// These keys belonged to the pre-Supabase login. They are removed for
// backwards compatibility, but are never read as identity or authentication.
const LEGACY_IDENTITY_KEYS = ['userEmail', 'showdown.userId'] as const;

export const TEMP_AUTH_KEYS = [
  'temp_auth_email',
  'temp_auth_code',
  'temp_auth_step',
  'temp_auth_expire',
  'temp_auth_agreements_at',
] as const;

export function clearLegacyIdentityCache() {
  LEGACY_IDENTITY_KEYS.forEach((key) => safeLocalStorage.removeItem(key));
}

function clearTempAuthDraft() {
  TEMP_AUTH_KEYS.forEach((key) => safeLocalStorage.removeItem(key));
}

/** Wipe the local login so the next screen is registration, not an empty profile. */
export async function endLocalSession(email?: string) {
  const previousAuthValue = safeLocalStorage.getItem('showdown.auth.session');
  const verifiedEmail = email?.trim().toLowerCase() ?? '';
  clearLegacyIdentityCache();
  clearTempAuthDraft();
  if (verifiedEmail) clearUserData(verifiedEmail);
  // End the Auth session as well, not just the old display-cache keys.
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Logout still clears local credentials when the network is unavailable.
  } finally {
    if (safeLocalStorage.getItem('showdown.auth.session') === previousAuthValue) {
      safeLocalStorage.removeItem('showdown.auth.session');
    }
  }
}
