import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), write: vi.fn(), upsert: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from }, logSupabaseError: vi.fn() }));
vi.mock('./session', () => ({ writeSession: mocks.write }));
vi.mock('./clubDirectory', () => ({ upsertClubDirectory: mocks.upsert, getClubDirectory: vi.fn(), setClubDirectory: vi.fn() }));
import { ConsentRequiredError, loginOrRegisterUser } from './loginAccount';
import { lookupSessionAccount } from './userApi';

const user = { id: 'synthetic-profile', email: 'member@example.test', nickname: 'Test',
  role: 'admin', is_admin: true, ruby_balance: 1234 };
beforeEach(() => vi.clearAllMocks());
describe('server-authoritative profile binding', () => {
  it('passes only consent to the server, never identity or desired role', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'ready', is_new: false, user }, error: null });
    const result = await loginOrRegisterUser(' Member@Example.test ');
    expect(mocks.rpc).toHaveBeenCalledWith('club_open_session', { p_accept_agreements: false });
    expect(result.user.role).toBe('admin');
    expect(result.user.coins).toBe(1234);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('does not register or write display cache before consent is accepted', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'consent_required' }, error: null });
    await expect(loginOrRegisterUser('new@example.test')).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('does not trust the old admin flag without a server-issued role', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'ready', user: { ...user, role: undefined } }, error: null });
    await expect(loginOrRegisterUser(user.email)).rejects.toThrow('подтвердить профиль');
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('rejects a profile for another email and never falls back to anonymous lookup', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'ready', user }, error: null });
    await expect(loginOrRegisterUser('other@example.test')).rejects.toThrow('подтвердить профиль');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('ignores legacy user ID and email when refreshing the current account', async () => {
    mocks.rpc.mockResolvedValue({ data: user, error: null });
    const result = await lookupSessionAccount('forged-admin-id', 'owner@example.test');
    expect(mocks.rpc).toHaveBeenCalledWith('club_current_account');
    expect(result.status).toBe('found');
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
