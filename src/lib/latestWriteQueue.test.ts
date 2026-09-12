import { describe, expect, it, vi } from 'vitest';
import { createLatestWriteQueue } from './latestWriteQueue';

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('latest write queue', () => {
  it('keeps only the newest value while a write is in flight', async () => {
    const gate = deferred();
    const seen: string[] = [];
    const queue = createLatestWriteQueue<string>(async (value) => {
      seen.push(value);
      if (seen.length === 1) await gate.promise;
    });

    queue('a');
    queue('b');
    queue('c');
    gate.resolve();
    await vi.waitFor(() => expect(seen).toEqual(['a', 'c']));
  });

  it('reports a failed write and still accepts the next one', async () => {
    const onError = vi.fn();
    const seen: string[] = [];
    const queue = createLatestWriteQueue<string>(async (value) => {
      seen.push(value);
      if (value === 'boom') throw new Error('offline');
    }, onError);

    queue('boom');
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    queue('ok');
    await vi.waitFor(() => expect(seen).toEqual(['boom', 'ok']));
  });
});
