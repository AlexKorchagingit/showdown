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

/**
 * Club data uses the anon key as a public PostgREST client — not Supabase Auth.
 * `accessToken` skips GoTrue `getSession()` so the client does not wait on Auth.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => supabaseAnonKey,
  global: {
    fetch: createTimeoutFetch(12000),
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

/** Print the PostgREST body (column missing, bad embed, …) instead of a bare HTTP 400. */
export function logSupabaseError(error: PostgrestError | { message?: string } | null, context?: string) {
  if (!error) return;
  console.error('Supabase Query Error:', context ? `${context}:` : '', error);
}
