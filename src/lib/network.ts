export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

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
