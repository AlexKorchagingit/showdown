import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { createApiRouteFetch, createTimeoutFetch } from './network';
import { safeLocalStorage } from './safeStorage';

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const configuredFallbackUrls = (import.meta.env.VITE_SUPABASE_FALLBACK_URL || '')
  .split(',')
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

if (supabaseUrl.includes(':8000')) {
  throw new Error('VITE_SUPABASE_URL must be https://api.showdown-br.ru without port 8000');
}

const productionFallbackUrls = (() => {
  try {
    return new URL(supabaseUrl).hostname === 'api.showdown-br.ru'
      ? [
          'https://direct-api.showdown-br.ru',
        ]
      : [];
  } catch {
    return [];
  }
})();

export const supabaseFallbackUrls = [...configuredFallbackUrls, ...productionFallbackUrls]
  .filter((url, index, urls) => url !== supabaseUrl && urls.indexOf(url) === index);
export const supabaseFallbackUrl = supabaseFallbackUrls[0] || '';
// Two independent routes must fit inside the 10-second startup budget.
const perRouteFetch = createTimeoutFetch(4_000);
export const supabaseFetch = createTimeoutFetch(15_000, createApiRouteFetch({
  primaryBaseUrl: supabaseUrl,
  fallbackBaseUrls: supabaseFallbackUrls,
  probeTimeoutMs: 2_000,
  fetchImpl: perRouteFetch,
}));

/** Personal Auth tokens identify callers; the anon key is only the public API key. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: supabaseFetch,
  },
  auth: {
    storageKey: 'showdown.auth.session',
    storage: safeLocalStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    lockAcquireTimeout: 10_000,
  },
});

/** Print the PostgREST body (column missing, bad embed, …) instead of a bare HTTP 400. */
export function logSupabaseError(error: PostgrestError | { message?: string } | null, context?: string) {
  if (!error) return;
  console.error('Supabase Query Error:', context ? `${context}:` : '', error);
}
