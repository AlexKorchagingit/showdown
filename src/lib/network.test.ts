import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTimeoutFetch,
  isUncertainNetworkError,
  requestErrorMessage,
  RequestTimeoutError,
  withRequestDeadline,
} from './network';

describe('createTimeoutFetch', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns a successful response', async () => {
    const response = new Response('{}', { status: 200 });
    const fetchImpl = vi.fn(async () => response);
    const timedFetch = createTimeoutFetch(1000, fetchImpl);

    await expect(timedFetch('https://api.example.test')).resolves.toBe(response);
  });

  it('aborts a request that exceeds the deadline', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    }));
    const timedFetch = createTimeoutFetch(5000, fetchImpl);
    const result = timedFetch('https://api.example.test');
    const rejection = expect(result).rejects.toBeInstanceOf(RequestTimeoutError);

    await vi.advanceTimersByTimeAsync(5000);

    await rejection;
  });

  it('preserves a caller initiated abort', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    }));
    const timedFetch = createTimeoutFetch(5000, fetchImpl);
    const result = timedFetch('https://api.example.test', { signal: controller.signal });

    controller.abort(new DOMException('Caller cancelled', 'AbortError'));

    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('keeps a deadline on Android WebView without AbortController', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('AbortController', undefined);
    const fetchImpl = vi.fn(() => new Promise<Response>(() => undefined));
    const timedFetch = createTimeoutFetch(5000, fetchImpl);
    const result = timedFetch('https://api.example.test');
    const rejection = expect(result).rejects.toBeInstanceOf(RequestTimeoutError);

    await vi.advanceTimersByTimeAsync(5000);

    await rejection;
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe('requestErrorMessage', () => {
  it('hides timeout implementation details from the user', () => {
    expect(requestErrorMessage(new RequestTimeoutError(12000), 'Не удалось войти')).toBe(
      'Сервер отвечает дольше обычного. Проверьте интернет и попробуйте ещё раз.',
    );
  });

  it('uses the operation fallback for an unknown error', () => {
    expect(requestErrorMessage(new Error('internal detail'), 'Не удалось проверить почту')).toBe(
      'Не удалось проверить почту',
    );
  });
});

describe('withRequestDeadline', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an operation that finishes before the deadline', async () => {
    await expect(withRequestDeadline(Promise.resolve('ok'), 5000)).resolves.toBe('ok');
  });

  it('stops waiting even when work before fetch never settles', async () => {
    vi.useFakeTimers();
    const result = withRequestDeadline(new Promise<string>(() => undefined), 15000);
    const rejection = expect(result).rejects.toBeInstanceOf(RequestTimeoutError);

    await vi.advanceTimersByTimeAsync(15000);

    await rejection;
  });
});

describe('isUncertainNetworkError', () => {
  it('identifies failures where the server may have processed the request', () => {
    expect(isUncertainNetworkError(new RequestTimeoutError(12000))).toBe(true);
    expect(isUncertainNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isUncertainNetworkError(new Error('Server rejected the request'))).toBe(false);
  });
});
