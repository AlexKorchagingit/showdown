import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { createTimeoutFetch } from './network';

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

if (supabaseUrl.includes(':8000')) {
  throw new Error('VITE_SUPABASE_URL must be https://api.showdown-br.ru without port 8000');
}

/** Personal Auth tokens identify callers; the anon key is only the public API key. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: createTimeoutFetch(12000),
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
