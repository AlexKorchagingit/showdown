import { createClient, type PostgrestError } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * The app uses the anon key as a public PostgREST client — not Supabase Auth.
 * Default `getSession()` waits on GoTrue init and can hang in Telegram WebView
 * (localStorage / URL hash / auth recover), so login never finishes.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => supabaseAnonKey,
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
