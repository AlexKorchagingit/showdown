import { describe, expect, it, vi } from 'vitest';
import { createOtpClient, OtpApiError } from './otpApi';

const config = {
  baseUrl: 'https://api.example.test',
  anonKey: 'public-anon-key',
};

describe('OTP API client', () => {
  it('requests a code through the server without receiving the code', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ accepted: true }), { status: 202 }));
    const client = createOtpClient({ ...config, fetchImpl });

    await expect(client.requestCode(' User@Example.com ')).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.test/functions/v1/login-otp/request',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
    );
  });

  it('reports server rate limiting without exposing response details', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { 'Retry-After': '60' },
    }));
    const client = createOtpClient({ ...config, fetchImpl });

    await expect(client.requestCode('user@example.com')).rejects.toMatchObject({
      code: 'rate_limited',
      retryAfter: 60,
    });
  });

  it('verifies the code on the server', async () => {
    const session = { access_token: 'synthetic-access-token', refresh_token: 'synthetic-refresh-token' };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ verified: true, session }), { status: 200 }));
    const storeSession = vi.fn(async () => undefined);
    const client = createOtpClient({ ...config, fetchImpl, storeSession });

    await expect(client.verifyCode('user@example.com', '1234')).resolves.toBe(true);
    expect(storeSession).toHaveBeenCalledWith(session);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.test/functions/v1/login-otp/verify',
      expect.objectContaining({ body: JSON.stringify({ email: 'user@example.com', code: '1234' }) }),
    );
  });

  it('rejects the old verified-only response instead of pretending the user is signed in', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ verified: true }));
    const storeSession = vi.fn();
    const client = createOtpClient({ ...config, fetchImpl, storeSession });
    await expect(client.verifyCode('user@example.com', '1234')).rejects.toBeInstanceOf(OtpApiError);
    expect(storeSession).not.toHaveBeenCalled();
  });

  it('does not report success or leak details when storing the session fails', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ verified: true,
      session: { access_token: 'synthetic', refresh_token: 'synthetic' } }));
    const client = createOtpClient({ ...config, fetchImpl, storeSession: async () => { throw new Error('sensitive-provider-details'); } });
    await expect(client.verifyCode('user@example.com', '1234')).rejects.toThrow('Не удалось сохранить сессию');
  });

  it('returns false for an invalid or expired code', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ verified: false }), { status: 400 }));
    const client = createOtpClient({ ...config, fetchImpl });

    await expect(client.verifyCode('user@example.com', '9999')).resolves.toBe(false);
  });

  it('rejects invalid input before making a request', async () => {
    const fetchImpl = vi.fn();
    const client = createOtpClient({ ...config, fetchImpl });

    await expect(client.requestCode('not-an-email')).rejects.toBeInstanceOf(OtpApiError);
    await expect(client.verifyCode('user@example.com', '12ab')).rejects.toBeInstanceOf(OtpApiError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
