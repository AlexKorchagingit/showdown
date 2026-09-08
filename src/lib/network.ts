export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface ApiRouteFetchOptions {
  primaryBaseUrl: string;
  fallbackBaseUrls?: readonly string[];
  probePath?: string;
  probeTimeoutMs?: number;
  failureCooldownMs?: number;
  fetchImpl?: FetchLike;
}

export class RequestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'RequestTimeoutError';
  }
}

/**
 * Bound the complete client operation, including work performed before fetch starts
 * (for example, restoring or refreshing the Supabase Auth session).
 */
export async function withRequestDeadline<T>(
  request: PromiseLike<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new RequestTimeoutError(timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(request), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function isUncertainNetworkError(error: unknown): boolean {
  return error instanceof RequestTimeoutError ||
    error instanceof TypeError ||
    (error instanceof Error && (error.name === 'RequestTimeoutError' || error.name === 'TypeError'));
}

export function requestErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof RequestTimeoutError || (error instanceof Error && error.name === 'RequestTimeoutError')) {
    return 'Сервер отвечает дольше обычного. Проверьте интернет и попробуйте ещё раз.';
  }
  if (error instanceof TypeError) {
    return 'Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.';
  }
  return fallback;
}

export function createTimeoutFetch(timeoutMs: number, fetchImpl: FetchLike = fetch): FetchLike {
  return async (input, init = {}) => {
    // Chromium 61 (the oldest supported Android WebView) has fetch but may not
    // expose AbortController. The deadline still releases the UI; only browser
    // cancellation of the underlying request is unavailable in that fallback.
    if (typeof AbortController === 'undefined') {
      return await withRequestDeadline(fetchImpl(input, init), timeoutMs);
    }

    const controller = new AbortController();
    const callerSignal = init.signal;
    const timeoutError = new RequestTimeoutError(timeoutMs);
    let timedOut = false;

    const abortFromCaller = () => controller.abort(callerSignal?.reason);
    if (callerSignal?.aborted) {
      abortFromCaller();
    } else {
      callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
    }

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(timeoutError);
    }, timeoutMs);

    try {
      return await fetchImpl(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (timedOut) throw timeoutError;
      throw error;
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', abortFromCaller);
    }
  };
}

function normalizedBaseUrl(value: string): string {
  return value.replace(/\/$/, '');
}

function rewriteRequestBase(
  input: RequestInfo | URL,
  primaryBaseUrl: string,
  selectedBaseUrl: string,
): RequestInfo | URL {
  const originalUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  if (selectedBaseUrl === primaryBaseUrl ||
      (originalUrl !== primaryBaseUrl && !originalUrl.startsWith(`${primaryBaseUrl}/`))) {
    return input;
  }

  const rewrittenUrl = `${selectedBaseUrl}${originalUrl.slice(primaryBaseUrl.length)}`;
  if (typeof input === 'string') return rewrittenUrl;
  if (input instanceof URL) return new URL(rewrittenUrl);
  return new Request(rewrittenUrl, input);
}

const RETRYABLE_RPC = new Set([
  'club_audit_snapshot',
  'club_blind_structures_snapshot',
  'club_current_account',
  'club_directory',
  'club_finance_snapshot',
  'club_personnel_snapshot',
  'club_tournament_snapshot',
  'club_wallet_snapshot',
]);

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
}

function isSafeToRetry(input: RequestInfo | URL, init: RequestInit): boolean {
  const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  if (method !== 'POST') return false;

  try {
    const url = new URL(requestUrl(input));
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') return true;
    const rpcPrefix = '/rest/v1/rpc/';
    return url.pathname.startsWith(rpcPrefix) && RETRYABLE_RPC.has(url.pathname.slice(rpcPrefix.length));
  } catch {
    return false;
  }
}

/**
 * Select the first API route that is actually reachable from the current
 * browser. The probe is a safe GET, so POST/RPC calls are still sent exactly
 * once and cannot be duplicated while switching between routes.
 */
export function createApiRouteFetch({
  primaryBaseUrl,
  fallbackBaseUrls = [],
  probePath = '/auth/v1/settings',
  probeTimeoutMs = 3500,
  failureCooldownMs = 60_000,
  fetchImpl = fetch,
}: ApiRouteFetchOptions): FetchLike {
  const primary = normalizedBaseUrl(primaryBaseUrl);
  const routes = [primary, ...fallbackBaseUrls.map(normalizedBaseUrl)]
    .filter((route, index, values) => route && values.indexOf(route) === index);
  const probeFetch = createTimeoutFetch(probeTimeoutMs, fetchImpl);
  let selectedRoute: string | undefined;
  let selection: Promise<string> | undefined;
  const failedUntil = new Map<string, number>();

  const routeIsCoolingDown = (route: string) => (failedUntil.get(route) ?? 0) > Date.now();

  const selectReachableRoute = (): Promise<string> => {
    if (selectedRoute && !routeIsCoolingDown(selectedRoute)) return Promise.resolve(selectedRoute);
    selectedRoute = undefined;
    if (selection) return selection;

    const availableRoutes = routes.filter((route) => !routeIsCoolingDown(route));
    const candidates = availableRoutes.length > 0 ? availableRoutes : routes;

    const pendingSelection = new Promise<string>((resolve, reject) => {
      let failuresRemaining = candidates.length;
      let lastError: unknown = new TypeError('No API route is reachable');
      let settled = false;

      for (const route of candidates) {
        probeFetch(`${route}${probePath}`, {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        }).then(() => {
          // Every probe keeps running after the promise resolves. Without this
          // guard, a slower successful route can overwrite the actual winner
          // and send later requests back through an unstable connection.
          if (settled) return;
          settled = true;
          selectedRoute = route;
          resolve(route);
        }).catch((error: unknown) => {
          if (settled) return;
          lastError = error;
          failuresRemaining -= 1;
          if (failuresRemaining === 0) {
            settled = true;
            reject(lastError);
          }
        });
      }
    });

    selection = pendingSelection.then(
      (route) => {
        selection = undefined;
        return route;
      },
      (error: unknown) => {
        selection = undefined;
        throw error;
      },
    );

    return selection;
  };

  const fetchFromRoute = async (
    route: string,
    input: RequestInfo | URL,
    init: RequestInit,
  ): Promise<Response> => {
    try {
      const response = await fetchImpl(rewriteRequestBase(input, primary, route), init);
      failedUntil.delete(route);
      return response;
    } catch (error) {
      failedUntil.set(route, Date.now() + failureCooldownMs);
      if (selectedRoute === route) selectedRoute = undefined;
      throw error;
    }
  };

  return async (input, init = {}) => {
    const retryable = routes.length > 1 && isSafeToRetry(input, init);
    const firstInput = input instanceof Request ? input.clone() : input;
    const retryInput = retryable && input instanceof Request ? input.clone() : input;
    const route = await selectReachableRoute();

    try {
      return await fetchFromRoute(route, firstInput, init);
    } catch (error) {
      // Mutating calls are never replayed: the server may already have applied
      // them. Reads and refresh-token exchange are safe to retry once through
      // a different route; Supabase permits refresh-token reuse briefly for
      // recovery from a lost response.
      if (!retryable) throw error;
      const retryRoute = await selectReachableRoute();
      return await fetchFromRoute(retryRoute, retryInput, init);
    }
  };
}
