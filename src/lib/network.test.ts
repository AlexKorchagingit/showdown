import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createApiRouteFetch,
  createClassifiedTimeoutFetch,
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
      if (url.startsWith('https://api.example.test')) {
        throw new TypeError('proxied route blocked');
      }
      return new Response('{}', { status: 200 });
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

  it('can select a third route when the standard HTTPS paths are blocked', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (!url.startsWith('https://direct-api.example.test:8443')) {
        throw new TypeError('standard HTTPS route blocked');
      }
      return new Response('{}', { status: url.endsWith('/auth/v1/settings') ? 401 : 200 });
    });
    const routedFetch = createApiRouteFetch({
      primaryBaseUrl: 'https://api.example.test',
      fallbackBaseUrls: [
        'https://direct-api.example.test',
        'https://direct-api.example.test:8443',
      ],
      fetchImpl,
    });

    await expect(routedFetch('https://api.example.test/rest/v1/users')).resolves.toMatchObject({ status: 200 });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://direct-api.example.test:8443/rest/v1/users',
      {},
    );
  });

  it('keeps using the selected route without probing endpoints', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    const routedFetch = createApiRouteFetch({
      primaryBaseUrl: 'https://api.example.test',
      fetchImpl,
    });

    await routedFetch('https://api.example.test/rest/v1/users');
    await routedFetch('https://api.example.test/rest/v1/shop_items');

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not let a late response overwrite the route which recovered the startup', async () => {
    let resolveSlowPrimary!: (response: Response) => void;
    let primaryCalls = 0;
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.startsWith('https://api.example.test')) {
        primaryCalls += 1;
        if (primaryCalls === 1) {
          return new Promise<Response>((resolve) => { resolveSlowPrimary = resolve; });
        }
        return Promise.reject(new TypeError('primary route failed'));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
    const routedFetch = createApiRouteFetch({
      primaryBaseUrl: 'https://api.example.test',
      fallbackBaseUrls: ['https://direct-api.example.test'],
      fetchImpl,
    });

    const slowRequest = routedFetch('https://api.example.test/rest/v1/users');
    await routedFetch('https://api.example.test/rest/v1/shop_items');

    resolveSlowPrimary(new Response('{}', { status: 200 }));
    await slowRequest;
    await routedFetch('https://api.example.test/rest/v1/tournaments');

    const applicationUrls = fetchImpl.mock.calls
      .map(([input]) => input.toString())
      .filter((url) => !url.endsWith('/auth/v1/settings'));
    expect(applicationUrls).toEqual([
      'https://api.example.test/rest/v1/users',
      'https://api.example.test/rest/v1/shop_items',
      'https://direct-api.example.test/rest/v1/shop_items',
      'https://direct-api.example.test/rest/v1/tournaments',
    ]);
  });

  it('retries a transient proxy response through the other route', async () => {
    const applicationUrls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      applicationUrls.push(url);
      if (url.startsWith('https://api.')) return new Response('', { status: 504 });
      return new Response('{}', { status: 200 });
    });
    const routedFetch = createApiRouteFetch({
      primaryBaseUrl: 'https://api.example.test',
      fallbackBaseUrls: ['https://direct-api.example.test'],
      fetchImpl,
    });

    await expect(routedFetch('https://api.example.test/rest/v1/users')).resolves.toMatchObject({ status: 200 });
    expect(applicationUrls).toEqual([
      'https://api.example.test/rest/v1/users',
      'https://direct-api.example.test/rest/v1/users',
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

    expect(probes).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not replay a write when the proxy returns a transient status', async () => {
    const applicationUrls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith('/auth/v1/settings')) return new Response('{}', { status: 401 });
      applicationUrls.push(url);
      return new Response('', { status: 504 });
    });
    const routedFetch = createApiRouteFetch({
      primaryBaseUrl: 'https://api.example.test',
      fallbackBaseUrls: ['https://direct-api.example.test'],
      fetchImpl,
    });

    await expect(routedFetch('https://api.example.test/rest/v1/rpc/critical_command', {
      method: 'POST',
      body: '{}',
    })).resolves.toMatchObject({ status: 504 });
    expect(applicationUrls).toEqual([
      'https://api.example.test/rest/v1/rpc/critical_command',
    ]);
  });

  it('retries a failed read once through a different route', async () => {
    const applicationUrls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith('/auth/v1/settings')) return new Response('{}', { status: 401 });
      applicationUrls.push(url);
      if (url.startsWith('https://api.')) throw new TypeError('primary route stalled');
      return new Response('{}', { status: 200 });
    });
    const routedFetch = createApiRouteFetch({
      primaryBaseUrl: 'https://api.example.test',
      fallbackBaseUrls: ['https://direct-api.example.test'],
      fetchImpl,
    });

    await expect(routedFetch('https://api.example.test/rest/v1/users')).resolves.toMatchObject({ status: 200 });
    expect(applicationUrls).toEqual([
      'https://api.example.test/rest/v1/users',
      'https://direct-api.example.test/rest/v1/users',
    ]);
  });

  it('recovers a lost refresh-token response without replaying other POST requests', async () => {
    const applicationUrls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith('/auth/v1/settings')) return new Response('{}', { status: 401 });
      applicationUrls.push(url);
      if (url.startsWith('https://api.')) throw new TypeError('refresh response lost');
      return new Response('{}', { status: 200 });
    });
    const routedFetch = createApiRouteFetch({
      primaryBaseUrl: 'https://api.example.test',
      fallbackBaseUrls: ['https://direct-api.example.test'],
      fetchImpl,
    });

    await expect(routedFetch('https://api.example.test/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: '{}',
    })).resolves.toMatchObject({ status: 200 });
    expect(applicationUrls).toEqual([
      'https://api.example.test/auth/v1/token?grant_type=refresh_token',
      'https://direct-api.example.test/auth/v1/token?grant_type=refresh_token',
    ]);
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

describe('createClassifiedTimeoutFetch', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps retryable snapshot reads on the short route deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let abortedAt = -1;
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        abortedAt = Date.now();
        reject(init.signal?.reason);
      });
    }));
    const classifiedFetch = createClassifiedTimeoutFetch(4000, 8000, fetchImpl);
    const result = classifiedFetch('https://api.example.test/rest/v1/rpc/club_current_account', {
      method: 'POST', body: '{}',
    });
    const rejection = expect(result).rejects.toBeInstanceOf(RequestTimeoutError);

    await vi.advanceTimersByTimeAsync(4000);

    await rejection;
    expect(abortedAt).toBe(4000);
  });

  it('allows a non-replayable session write eight seconds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let abortedAt = -1;
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        abortedAt = Date.now();
        reject(init.signal?.reason);
      });
    }));
    const classifiedFetch = createClassifiedTimeoutFetch(4000, 8000, fetchImpl);
    const result = classifiedFetch('https://api.example.test/rest/v1/rpc/club_open_session', {
      method: 'POST', body: '{}',
    });
    const rejection = expect(result).rejects.toBeInstanceOf(RequestTimeoutError);

    await vi.advanceTimersByTimeAsync(8000);

    await rejection;
    expect(abortedAt).toBe(8000);
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
