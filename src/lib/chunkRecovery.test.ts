import { describe, expect, it, vi } from 'vitest';
import {
  CHUNK_RECOVERY_STORAGE_KEY,
  forceFreshPageLoad,
  isChunkLoadError,
  loadWithChunkRecovery,
  recoverFromChunkLoadError,
  type ChunkRecoveryEnvironment,
} from './chunkRecovery';

function createEnvironment(storedBuildId: string | null = null) {
  const values = new Map<string, string>();
  if (storedBuildId) values.set(CHUNK_RECOVERY_STORAGE_KEY, storedBuildId);

  const replace = vi.fn();
  const environment: ChunkRecoveryEnvironment = {
    href: 'https://showdown-br.ru/tournaments?tab=active#top',
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    replace,
  };

  return { environment, replace, values };
}

describe('chunk recovery', () => {
  it.each([
    new TypeError('Failed to fetch dynamically imported module'),
    new Error('Importing a module script failed'),
    Object.assign(new Error('Loading chunk 42 failed'), { name: 'ChunkLoadError' }),
  ])('recognises a stale deployment error', (error) => {
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('does not reload for an unrelated application error', () => {
    expect(isChunkLoadError(new Error('Database request failed'))).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
  });

  it('reloads once with a cache-busting build id and preserves the current route', () => {
    const { environment, replace, values } = createEnvironment();

    const recovered = recoverFromChunkLoadError(
      new TypeError('Failed to fetch dynamically imported module'),
      'build-2026-08-31',
      environment,
    );

    expect(recovered).toBe(true);
    expect(values.get(CHUNK_RECOVERY_STORAGE_KEY)).toBe('build-2026-08-31');
    expect(replace).toHaveBeenCalledOnce();
    expect(replace.mock.calls[0][0]).toBe(
      'https://showdown-br.ru/tournaments?tab=active&__showdown_refresh=build-2026-08-31#top',
    );
  });

  it('does not loop when the same build still cannot load', () => {
    const { environment, replace } = createEnvironment('build-2026-08-31');

    const recovered = recoverFromChunkLoadError(
      new TypeError('Failed to fetch dynamically imported module'),
      'build-2026-08-31',
      environment,
    );

    expect(recovered).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it('allows automatic recovery again after a later deployment', () => {
    const { environment, replace } = createEnvironment('build-2026-08-30');

    const recovered = recoverFromChunkLoadError(
      new TypeError('Failed to fetch dynamically imported module'),
      'build-2026-08-31',
      environment,
    );

    expect(recovered).toBe(true);
    expect(replace).toHaveBeenCalledOnce();
  });

  it('uses the URL loop guard when Safari storage is unavailable', () => {
    const replace = vi.fn();
    const environment: ChunkRecoveryEnvironment = {
      href: 'https://showdown-br.ru/',
      storage: {
        getItem: () => {
          throw new Error('Storage disabled');
        },
        setItem: () => {
          throw new Error('Storage disabled');
        },
      },
      replace,
    };

    expect(recoverFromChunkLoadError(
      new Error('Importing a module script failed'),
      'new-build',
      environment,
    )).toBe(true);
    expect(replace).toHaveBeenCalledWith('https://showdown-br.ru/?__showdown_refresh=new-build');

    environment.href = 'https://showdown-br.ru/?__showdown_refresh=new-build';
    expect(recoverFromChunkLoadError(
      new Error('Importing a module script failed'),
      'new-build',
      environment,
    )).toBe(false);
  });

  it('returns the loaded module without navigating when the chunk is current', async () => {
    const { environment, replace } = createEnvironment();

    await expect(loadWithChunkRecovery(
      async () => ({ default: 'screen' }),
      'current-build',
      environment,
    )).resolves.toEqual({ default: 'screen' });
    expect(replace).not.toHaveBeenCalled();
  });

  it('rethrows an unrelated lazy screen error', async () => {
    const { environment, replace } = createEnvironment();
    const error = new Error('Application render failed');

    await expect(loadWithChunkRecovery(
      async () => { throw error; },
      'current-build',
      environment,
    )).rejects.toBe(error);
    expect(replace).not.toHaveBeenCalled();
  });

  it('keeps the old screen pending while navigation replaces it', async () => {
    const { environment, replace } = createEnvironment();
    const result = loadWithChunkRecovery(
      async () => { throw new TypeError('Failed to fetch dynamically imported module'); },
      'current-build',
      environment,
    );

    const state = await Promise.race([
      result.then(() => 'resolved', () => 'rejected'),
      new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 5)),
    ]);

    expect(state).toBe('pending');
    expect(replace).toHaveBeenCalledOnce();
  });

  it('creates a fresh URL for the visible retry without touching cookies', () => {
    const { environment, replace } = createEnvironment();

    forceFreshPageLoad(environment, 12345);

    expect(replace).toHaveBeenCalledWith(
      `https://showdown-br.ru/tournaments?tab=active&__showdown_refresh=${__APP_BUILD_ID__}-12345#top`,
    );
  });

  it('does nothing when there is no browser environment', () => {
    expect(recoverFromChunkLoadError(
      new Error('Importing a module script failed'),
      'current-build',
      null,
    )).toBe(false);
    expect(() => forceFreshPageLoad(null, 12345)).not.toThrow();
  });

  it('uses the real browser adapter when no test environment is supplied', () => {
    const replace = vi.fn();
    vi.stubGlobal('window', {
      location: {
        href: 'https://showdown-br.ru/profile',
        replace,
      },
      sessionStorage: {
        getItem: () => null,
        setItem: vi.fn(),
      },
    });

    forceFreshPageLoad(undefined, 67890);

    expect(replace).toHaveBeenCalledWith(
      `https://showdown-br.ru/profile?__showdown_refresh=${__APP_BUILD_ID__}-67890`,
    );
    vi.unstubAllGlobals();
  });
});
