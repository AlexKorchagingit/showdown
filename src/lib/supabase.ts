import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { REQUEST_TIMEOUT_MS } from './network';

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Cross-origin PostgREST (`showdown-br.ru` → `api.showdown-br.ru`).
 * `credentials: 'omit'` keeps the request non-credentialed so CORS does not
 * require `Access-Control-Allow-Credentials`. Extra client-info headers are
 * stripped so the preflight Allow-Headers list stays small.
 */
function fetchWithoutAuthSession(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const stall = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const parent = init?.signal;
  if (parent) {
    if (parent.aborted) controller.abort();
    else parent.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const headers = new Headers(init?.headers);
  headers.delete('X-Client-Info');
  headers.delete('x-client-info');

  return fetch(input, {
    ...init,
    credentials: 'omit',
    cache: 'no-store',
    mode: 'cors',
    signal: controller.signal,
    headers,
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
    timeout: REQUEST_TIMEOUT_MS,
    retry: false,
  },
  global: {
    fetch: fetchWithoutAuthSession,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  },
});

/** Print the PostgREST body (column missing, bad embed, …) instead of a bare HTTP 400. */
export function logSupabaseError(error: PostgrestError | { message?: string } | null, context?: string) {
  if (!error) return;
  console.error('Supabase Query Error:', context ? `${context}:` : '', error);
}
