import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  // Unit tests must inject fetch doubles. Never use a real production endpoint.
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('Network disabled in unit tests; inject a fetch mock');
  }));
});
