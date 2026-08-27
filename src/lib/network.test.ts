import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTimeoutFetch, RequestTimeoutError } from './network';

describe('createTimeoutFetch', () => {
  afterEach(() => {
    vi.useRealTimers();
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
});
