import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { createApiRouteFetch, createTimeoutFetch } from './network';

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const configuredFallbackUrl = (import.meta.env.VITE_SUPABASE_FALLBACK_URL || '').replace(/\/$/, '');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

if (supabaseUrl.includes(':8000')) {
  throw new Error('VITE_SUPABASE_URL must be https://api.showdown-br.ru without port 8000');
}

const productionFallbackUrl = (() => {
  try {
    return new URL(supabaseUrl).hostname === 'api.showdown-br.ru'
      ? 'https://direct-api.showdown-br.ru'
      : '';
  } catch {
    return '';
  }
})();

export const supabaseFallbackUrl = configuredFallbackUrl || productionFallbackUrl;
const perRouteFetch = createTimeoutFetch(6_000);
export const supabaseFetch = createTimeoutFetch(15_000, createApiRouteFetch({
  primaryBaseUrl: supabaseUrl,
  fallbackBaseUrls: supabaseFallbackUrl ? [supabaseFallbackUrl] : [],
  fetchImpl: perRouteFetch,
}));

/** Personal Auth tokens identify callers; the anon key is only the public API key. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: supabaseFetch,
  },
  auth: {
    storageKey: 'showdown.auth.session',
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
