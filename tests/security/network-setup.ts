const localFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  if (url.origin !== 'http://127.0.0.1:55430') {
    throw new Error('Security integration tests may access only the isolated loopback API');
  }
  return localFetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10_000) });
};
