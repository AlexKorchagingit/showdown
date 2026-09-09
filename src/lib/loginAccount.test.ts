import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), upsert: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from }, logSupabaseError: vi.fn() }));
vi.mock('./clubDirectory', () => ({ upsertClubDirectory: mocks.upsert, getClubDirectory: vi.fn(), setClubDirectory: vi.fn() }));
import { ConsentRequiredError, loginOrRegisterUser } from './loginAccount';
import { RequestTimeoutError } from './network';
import { lookupSessionAccount } from './userApi';

const user = { id: 'synthetic-profile', email: 'member@example.test', nickname: 'Test',
  role: 'admin', is_admin: true, ruby_balance: 1234 };
beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('server-authoritative profile binding', () => {
  it('passes only consent to the server, never identity or desired role', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'ready', is_new: false, user }, error: null });
    const result = await loginOrRegisterUser(' Member@Example.test ');
    expect(mocks.rpc).toHaveBeenCalledWith('club_open_session', { p_accept_agreements: false });
    expect(result.user.role).toBe('admin');
    expect(result.user.coins).toBe(1234);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('does not register before consent is accepted', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'consent_required' }, error: null });
    await expect(loginOrRegisterUser('new@example.test')).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('does not trust the old admin flag without a server-issued role', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'ready', user: { ...user, role: undefined } }, error: null });
    await expect(loginOrRegisterUser(user.email)).rejects.toThrow('подтвердить профиль');
  });
  it('rejects a profile for another email and never falls back to anonymous lookup', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'ready', user }, error: null });
    await expect(loginOrRegisterUser('other@example.test')).rejects.toThrow('подтвердить профиль');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('recovers a lost open-session response with a read-only account lookup', async () => {
    mocks.rpc
      .mockRejectedValueOnce(new RequestTimeoutError(8000))
      .mockResolvedValueOnce({ data: user, error: null });

    const result = await loginOrRegisterUser(user.email);

    expect(result).toMatchObject({ user: { id: user.id }, isNew: false });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'club_open_session', { p_accept_agreements: false });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'club_current_account');
  });
  it('releases the login UI at the common startup deadline', async () => {
    vi.useFakeTimers();
    mocks.rpc.mockReturnValue(new Promise(() => undefined));
    const result = loginOrRegisterUser(user.email);
    const rejection = expect(result).rejects.toMatchObject({ name: 'RequestTimeoutError' });

    await vi.advanceTimersByTimeAsync(10_000);

    await rejection;
  });
  it('resolves the current account without reading a client-supplied ID or email', async () => {
    const getItem = vi.fn(() => 'forged-superadmin');
    vi.stubGlobal('localStorage', { getItem });
    mocks.rpc.mockResolvedValue({ data: user, error: null });
    const result = await lookupSessionAccount();
    expect(mocks.rpc).toHaveBeenCalledWith('club_current_account');
    expect(result.status).toBe('found');
    expect(getItem).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('rejects an account response without a server-issued role', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...user, role: undefined }, error: null });
    await expect(lookupSessionAccount()).resolves.toMatchObject({ status: 'error' });
  });
});
