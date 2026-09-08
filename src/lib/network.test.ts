import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createApiRouteFetch,
  createTimeoutFetch,
  isUncertainNetworkError,
  requestErrorMessage,
  RequestTimeoutError,
  withRequestDeadline,
} from './network';

describe('createApiRouteFetch', () => {
  it('uses a reachable direct route when the proxied route is blocked', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === 'https://api.example.test/auth/v1/settings') {
        throw new TypeError('proxied route blocked');
      }
      return new Response('{}', { status: url.includes('/auth/v1/settings') ? 401 : 200 });
    });
    const routedFetch = createApiRouteFetch({
      primaryBaseUrl: 'https://api.example.test',
      fallbackBaseUrls: ['https://direct-api.example.test'],
      fetchImpl,
    });

    await expect(routedFetch('https://api.example.test/rest/v1/users')).resolves.toMatchObject({ status: 200 });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://direct-api.example.test/rest/v1/users',
      {},
    );
  });

  it('keeps using the selected route without probing every endpoint', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    const routedFetch = createApiRouteFetch({
      primaryBaseUrl: 'https://api.example.test',
      fetchImpl,
    });

    await routedFetch('https://api.example.test/rest/v1/users');
    await routedFetch('https://api.example.test/rest/v1/shop_items');

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('does not let a slower successful probe overwrite the first reachable route', async () => {
    let resolvePrimary!: (response: Response) => void;
    let resolveFallback!: (response: Response) => void;
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === 'https://api.example.test/auth/v1/settings') {
        return new Promise<Response>((resolve) => { resolvePrimary = resolve; });
      }
      if (url === 'https://direct-api.example.test/auth/v1/settings') {
        return new Promise<Response>((resolve) => { resolveFallback = resolve; });
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
    const routedFetch = createApiRouteFetch({
      primaryBaseUrl: 'https://api.example.test',
      fallbackBaseUrls: ['https://direct-api.example.test'],
      fetchImpl,
    });

    const firstRequest = routedFetch('https://api.example.test/rest/v1/users');
    resolveFallback(new Response('{}', { status: 401 }));
    await firstRequest;

    resolvePrimary(new Response('{}', { status: 401 }));
    await Promise.resolve();
    await routedFetch('https://api.example.test/rest/v1/shop_items');

    const applicationUrls = fetchImpl.mock.calls
      .map(([input]) => input.toString())
      .filter((url) => !url.endsWith('/auth/v1/settings'));
    expect(applicationUrls).toEqual([
      'https://direct-api.example.test/rest/v1/users',
      'https://direct-api.example.test/rest/v1/shop_items',
    ]);
  });

  it('does not replay a failed write on another route', async () => {
    let probes = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (input.toString().endsWith('/auth/v1/settings')) {
        probes += 1;
        if (input.toString().startsWith('https://api.')) return new Response('{}', { status: 401 });
        return new Promise<Response>(() => undefined);
      }
      throw new TypeError('connection reset after sending');
    });
    const routedFetch = createApiRouteFetch({
      primaryBaseUrl: 'https://api.example.test',
      fallbackBaseUrls: ['https://direct-api.example.test'],
      probeTimeoutMs: 10,
      fetchImpl,
    });

    await expect(routedFetch('https://api.example.test/rest/v1/rpc/critical_command', {
      method: 'POST',
      body: '{}',
    })).rejects.toThrow('connection reset after sending');

    expect(probes).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

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
