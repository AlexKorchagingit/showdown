import { describe, expect, it, vi } from 'vitest';
import { createSafeStorage, type BrowserStorage } from './safeStorage';

function mapStorage(values = new Map<string, string>()): BrowserStorage {
  return {
    get length() {
      return values.size;
    },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    key: (index) => [...values.keys()][index] ?? null,
  };
}

describe('safe storage adapter', () => {
  it('uses browser storage when it is available', () => {
    const values = new Map<string, string>();
    const storage = createSafeStorage(() => mapStorage(values));

    storage.setItem('session', 'token');

    expect(storage.getItem('session')).toBe('token');
    expect(storage.keys()).toEqual(['session']);
    storage.removeItem('session');
    expect(storage.getItem('session')).toBeNull();
  });

  it('never throws when access to the storage property is denied', () => {
    const storage = createSafeStorage(() => {
      throw new DOMException('Access denied', 'SecurityError');
    });

    expect(() => storage.setItem('session', 'token')).not.toThrow();
    expect(storage.getItem('session')).toBe('token');
    expect(storage.keys()).toEqual(['session']);
    expect(() => storage.removeItem('session')).not.toThrow();
    expect(storage.getItem('session')).toBeNull();
  });

  it('falls back to memory when individual storage methods throw', () => {
    const unavailable: BrowserStorage = {
      get length() { throw new DOMException('Blocked', 'SecurityError'); },
      getItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
      setItem: () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); },
      removeItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
      key: () => { throw new DOMException('Blocked', 'SecurityError'); },
    };
    const storage = createSafeStorage(() => unavailable);

    storage.setItem('draft', 'value');

    expect(storage.getItem('draft')).toBe('value');
    expect(storage.keys()).toEqual(['draft']);
    expect(() => storage.removeItem('draft')).not.toThrow();
  });

  it('keeps a failed write alive if browser storage later becomes readable', () => {
    const values = new Map<string, string>();
    let canWrite = false;
    const persistent = mapStorage(values);
    const setItem = vi.spyOn(persistent, 'setItem').mockImplementation((key, value) => {
      if (!canWrite) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      values.set(key, value);
    });
    const storage = createSafeStorage(() => persistent);

    storage.setItem('session', 'memory-token');
    expect(storage.getItem('session')).toBe('memory-token');

    canWrite = true;
    storage.setItem('session', 'persisted-token');
    expect(setItem).toHaveBeenCalledTimes(2);
    expect(storage.getItem('session')).toBe('persisted-token');
  });
});
