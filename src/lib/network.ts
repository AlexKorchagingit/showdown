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

function isTransientGatewayResponse(response: Response): boolean {
  return response.status === 408 ||
    response.status === 425 ||
    response.status === 502 ||
    response.status === 503 ||
    response.status === 504 ||
    (response.status >= 520 && response.status <= 527) ||
    response.status === 530;
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

  const orderedRoutes = () => {
    const available = routes.filter((route) => !routeIsCoolingDown(route));
    const candidates = available.length > 0 ? available : routes;
    if (!selectedRoute || !candidates.includes(selectedRoute)) return candidates;
    return [selectedRoute, ...candidates.filter((route) => route !== selectedRoute)];
  };

  const selectReachableRoute = (): Promise<string> => {
    if (selectedRoute && !routeIsCoolingDown(selectedRoute)) return Promise.resolve(selectedRoute);
    selectedRoute = undefined;
    if (selection) return selection;

    const pendingSelection = (async () => {
      let lastError: unknown = new TypeError('No API route is reachable');
      for (const route of orderedRoutes()) {
        try {
          await probeFetch(`${route}${probePath}`, {
            method: 'GET',
            cache: 'no-store',
            headers: { Accept: 'application/json' },
          });
          selectedRoute = route;
          failedUntil.delete(route);
          return route;
        } catch (error) {
          lastError = error;
          failedUntil.set(route, Date.now() + failureCooldownMs);
        }
      }
      throw lastError;
    })();

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
      // Several startup reads run concurrently. Once one route has recovered,
      // a late response from an older request must not switch the whole app
      // back to another route which has already failed for its peers.
      if (!selectedRoute || selectedRoute === route || routeIsCoolingDown(selectedRoute)) {
        selectedRoute = route;
      }
      return response;
    } catch (error) {
      failedUntil.set(route, Date.now() + failureCooldownMs);
      if (selectedRoute === route) selectedRoute = undefined;
      throw error;
    }
  };

  return async (input, init = {}) => {
    const retryable = isSafeToRetry(input, init);
    const requestForAttempt = () => input instanceof Request ? input.clone() : input;
    // Reads and refresh-token recovery are safe to repeat. Send them directly
    // through the preferred route so startup does not spend its budget on a
    // probe which says nothing about whether the real request body will pass.
    // Writes still require a successful probe and are never replayed.
    const preferredRoutes = retryable ? orderedRoutes() : [await selectReachableRoute()];
    const attemptRoutes = retryable
      ? [...preferredRoutes, ...routes.filter((route) => !preferredRoutes.includes(route))]
      : preferredRoutes;
    let lastError: unknown;
    let lastGatewayResponse: Response | undefined;

    for (const route of attemptRoutes) {
      try {
        const response = await fetchFromRoute(route, requestForAttempt(), init);
        if (!retryable || !isTransientGatewayResponse(response)) return response;

        lastGatewayResponse = response;
        failedUntil.set(route, Date.now() + failureCooldownMs);
        if (selectedRoute === route) selectedRoute = undefined;
      } catch (error) {
        // Mutating calls are never replayed: the server may already have
        // applied them. Reads and refresh-token exchange can safely continue
        // through each independent route. Supabase permits refresh-token reuse
        // briefly for recovery from a lost response.
        if (!retryable) throw error;
        lastError = error;
      }
    }

    if (lastGatewayResponse) return lastGatewayResponse;
    throw lastError ?? new TypeError('No API route is reachable');
  };
}
