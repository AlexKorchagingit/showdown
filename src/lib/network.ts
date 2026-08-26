export const REQUEST_TIMEOUT_MS = 5_000;

export class TimeoutError extends Error {
  constructor(message = 'Превышено время ожидания сервера') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Settle a promise within `ms` even if the underlying request never returns. */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number = REQUEST_TIMEOUT_MS,
  message = 'Превышено время ожидания сервера',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(new TimeoutError(message));
    }, ms);
    promise.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function isTimeoutError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}
