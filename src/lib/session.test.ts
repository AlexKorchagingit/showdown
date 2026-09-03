import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ signOut: vi.fn(), clear: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { auth: { signOut: mocks.signOut } } }));
vi.mock('./userStorage', () => ({ clearUserData: mocks.clear }));
import { endLocalSession } from './session';
let values: Map<string, string>;
beforeEach(() => {
  vi.clearAllMocks();
  values = new Map([['showdown.auth.session','old-session'], ['userEmail','member@example.test'], ['showdown.userId','profile']]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
describe('complete logout', () => {
  it('awaits Auth logout before completing', async () => {
    let finish!: () => void;
    mocks.signOut.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const logout = endLocalSession();
    expect(values.has('userEmail')).toBe(false);
    expect(values.has('showdown.auth.session')).toBe(true);
    finish();
    await logout;
    expect(values.has('showdown.auth.session')).toBe(false);
  });
  it('clears local credentials even if the network fails', async () => {
    mocks.signOut.mockRejectedValue(new Error('offline'));
    await endLocalSession();
    expect(values.has('showdown.auth.session')).toBe(false);
  });
  it('does not erase a newer session that appeared while logout was pending', async () => {
    mocks.signOut.mockImplementation(async () => { values.set('showdown.auth.session', 'new-session'); });
    await endLocalSession();
    expect(values.get('showdown.auth.session')).toBe('new-session');
  });
});
