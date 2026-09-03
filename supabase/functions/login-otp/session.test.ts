import { describe, expect, it, vi } from 'vitest';
import { verifyOtpAndIssueSession } from './session';

const options = { supabaseUrl: 'https://synthetic.example.test', serviceRoleKey: 'synthetic-server-key' };
describe('OTP-to-Auth session bridge', () => {
  it('does not request an Auth session until the OTP is consumed successfully', async () => {
    const fetchImpl = vi.fn(async () => Response.json('invalid'));
    await expect(verifyOtpAndIssueSession({ ...options, fetchImpl }, 'user@example.test', 'hash'))
      .resolves.toEqual({ verified: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('returns only user tokens, never administrative link data or service credentials', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json('verified'))
      .mockResolvedValueOnce(Response.json({ hashed_token: 'internal-only', action_link: 'private-link' }))
      .mockResolvedValueOnce(Response.json({ access_token: 'user-access', refresh_token: 'user-refresh',
        user: { id: 'synthetic-id', email: 'user@example.test', role: 'authenticated', email_confirmed_at: '2026-09-03' } }));
    await expect(verifyOtpAndIssueSession({ ...options, fetchImpl }, 'user@example.test', 'hash'))
      .resolves.toEqual({ verified: true, session: { access_token: 'user-access', refresh_token: 'user-refresh' } });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toEqual({ type: 'email', token_hash: 'internal-only' });
  });
  it('sanitizes upstream failures', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('secret-upstream-body'); });
    await expect(verifyOtpAndIssueSession({ ...options, fetchImpl }, 'user@example.test', 'hash'))
      .rejects.toThrow('Authentication temporarily unavailable');
  });
  it.each(['service_role', 'anon'])('rejects an unexpected Auth role: %s', async (role) => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json('verified'))
      .mockResolvedValueOnce(Response.json({ hashed_token: 'internal-only' }))
      .mockResolvedValueOnce(Response.json({ access_token: 'synthetic', refresh_token: 'synthetic',
        user: { id: 'id', email: 'user@example.test', role, email_confirmed_at: 'date' } }));
    await expect(verifyOtpAndIssueSession({ ...options, fetchImpl }, 'user@example.test', 'hash'))
      .rejects.toThrow('Authentication temporarily unavailable');
  });
  it('rejects a session returned for a different email', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json('verified'))
      .mockResolvedValueOnce(Response.json({ hashed_token: 'internal-only' }))
      .mockResolvedValueOnce(Response.json({ access_token: 'synthetic', refresh_token: 'synthetic',
        user: { id: 'id', email: 'other@example.test', role: 'authenticated', email_confirmed_at: 'date' } }));
    await expect(verifyOtpAndIssueSession({ ...options, fetchImpl }, 'user@example.test', 'hash'))
      .rejects.toThrow('Authentication temporarily unavailable');
  });
});
