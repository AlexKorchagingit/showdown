import { createClient, type PostgrestError } from '@supabase/supabase-js';

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const QUERY_STALL_MS = 8_000;

function fetchWithoutAuthSession(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const stall = setTimeout(() => controller.abort(), QUERY_STALL_MS);
  const parent = init?.signal;
  if (parent) {
    if (parent.aborted) controller.abort();
    else parent.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return fetch(input, {
    ...init,
    credentials: 'omit',
    signal: controller.signal,
  }).finally(() => clearTimeout(stall));
}

/**
 * Club data uses the anon key as a public PostgREST client.
 * Login itself does not go through this client — see `loginAccount.ts`.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => supabaseAnonKey,
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
  },
  db: {
    timeout: QUERY_STALL_MS,
    retry: false,
  },
  global: {
    fetch: fetchWithoutAuthSession,
  },
});

/** Print the PostgREST body (column missing, bad embed, …) instead of a bare HTTP 400. */
export function logSupabaseError(error: PostgrestError | { message?: string } | null, context?: string) {
  if (!error) return;
  console.error('Supabase Query Error:', context ? `${context}:` : '', error);
}
