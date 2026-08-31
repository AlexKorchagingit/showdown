export const CHUNK_RECOVERY_STORAGE_KEY = 'showdown:recovered-build';
export const CHUNK_RECOVERY_QUERY_KEY = '__showdown_refresh';

interface RecoveryStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface ChunkRecoveryEnvironment {
  href: string;
  storage: RecoveryStorage;
  replace: (url: string) => void;
}

const CHUNK_ERROR_PATTERNS = [
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'error loading dynamically imported module',
  'loading chunk',
  'chunkloaderror',
  'expected a javascript',
  'mime type',
];

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const description = `${error.name} ${error.message}`.toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => description.includes(pattern));
}

function browserEnvironment(): ChunkRecoveryEnvironment | null {
  if (typeof window === 'undefined') return null;
  return {
    href: window.location.href,
    storage: window.sessionStorage,
    replace: (url) => window.location.replace(url),
  };
}

export function recoverFromChunkLoadError(
  error: unknown,
  buildId: string,
  environment: ChunkRecoveryEnvironment | null = browserEnvironment(),
): boolean {
  if (!environment || !isChunkLoadError(error)) return false;

  const refreshUrl = new URL(environment.href);
  if (refreshUrl.searchParams.get(CHUNK_RECOVERY_QUERY_KEY) === buildId) return false;

  try {
    if (environment.storage.getItem(CHUNK_RECOVERY_STORAGE_KEY) === buildId) return false;
    environment.storage.setItem(CHUNK_RECOVERY_STORAGE_KEY, buildId);
  } catch {
    // Safari private mode may reject storage; the URL marker still prevents a loop.
  }

  refreshUrl.searchParams.set(CHUNK_RECOVERY_QUERY_KEY, buildId);
  environment.replace(refreshUrl.toString());
  return true;
}

export async function loadWithChunkRecovery<T>(
  loader: () => Promise<T>,
  buildId = __APP_BUILD_ID__,
  environment: ChunkRecoveryEnvironment | null = browserEnvironment(),
): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    if (recoverFromChunkLoadError(error, buildId, environment)) {
      return await new Promise<T>(() => undefined);
    }
    throw error;
  }
}

export function forceFreshPageLoad(
  environment: ChunkRecoveryEnvironment | null = browserEnvironment(),
  nonce = Date.now(),
): void {
  if (!environment) return;
  const url = new URL(environment.href);
  url.searchParams.set(CHUNK_RECOVERY_QUERY_KEY, `${__APP_BUILD_ID__}-${nonce}`);
  environment.replace(url.toString());
}
