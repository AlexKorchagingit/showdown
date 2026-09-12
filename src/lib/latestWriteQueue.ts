/**
 * Serialize writes to a single remote row and drop superseded ones: only the
 * newest state matters. Chaining every write instead (`chain = chain.then(…)`)
 * keeps every intermediate value alive, so a burst of edits — or two tabs
 * syncing with each other — grows an unbounded promise chain until the tab runs
 * out of memory.
 */
export function createLatestWriteQueue<T>(
  write: (value: T) => Promise<void>,
  onError: (error: unknown) => void = (error) => console.error(error),
): (value: T) => void {
  let pending: { value: T } | null = null;
  let draining = false;

  const drain = async () => {
    draining = true;
    try {
      while (pending) {
        const { value } = pending;
        pending = null;
        try {
          await write(value);
        } catch (error) {
          onError(error);
        }
      }
    } finally {
      draining = false;
    }
  };

  return (value: T) => {
    pending = { value };
    if (!draining) void drain();
  };
}
