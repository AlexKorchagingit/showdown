export interface BrowserStorage {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
}

export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

type StorageProvider = () => BrowserStorage | null;

/**
 * Browser storage can throw while accessing the property itself as well as
 * from any method (notably in private WebViews and restricted iframes).
 * Keep a per-tab memory copy so callers never need their own try/catch and
 * authentication can still complete for the lifetime of the current page.
 */
export function createSafeStorage(provider: StorageProvider): SafeStorage {
  const memory = new Map<string, string>();
  const volatileKeys = new Set<string>();

  const resolveStorage = (): BrowserStorage | null => {
    try {
      return provider();
    } catch {
      return null;
    }
  };

  return {
    getItem(key) {
      const storage = resolveStorage();
      if (!storage) return memory.get(key) ?? null;

      try {
        const value = storage.getItem(key);
        if (value !== null) {
          memory.set(key, value);
          volatileKeys.delete(key);
          return value;
        }
        if (volatileKeys.has(key)) return memory.get(key) ?? null;
        memory.delete(key);
        return null;
      } catch {
        return memory.get(key) ?? null;
      }
    },

    setItem(key, value) {
      memory.set(key, value);
      const storage = resolveStorage();
      if (!storage) {
        volatileKeys.add(key);
        return;
      }

      try {
        storage.setItem(key, value);
        volatileKeys.delete(key);
      } catch {
        volatileKeys.add(key);
      }
    },

    removeItem(key) {
      memory.delete(key);
      volatileKeys.delete(key);
      const storage = resolveStorage();
      if (!storage) return;

      try {
        storage.removeItem(key);
      } catch {
        // The in-memory copy is still removed for the current page.
      }
    },

    keys() {
      const storage = resolveStorage();
      if (!storage) return [...memory.keys()];

      try {
        const keys = new Set<string>();
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (key !== null) keys.add(key);
        }
        volatileKeys.forEach((key) => keys.add(key));
        return [...keys];
      } catch {
        return [...memory.keys()];
      }
    },
  };
}

export const safeLocalStorage = createSafeStorage(() => {
  if (typeof globalThis === 'undefined') return null;
  return globalThis.localStorage;
});
