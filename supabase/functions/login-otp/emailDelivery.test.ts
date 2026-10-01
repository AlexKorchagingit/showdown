import { describe, expect, it, vi } from 'vitest';
import { deliverOtpEmail } from './emailDelivery.ts';

const send = (fetchImpl: typeof fetch) => deliverOtpEmail(fetchImpl, 'https://example.test/send', {
  method: 'POST',
});

describe('OTP email delivery classification', () => {
  it('accepts a successful provider response', async () => {
    expect(await send(vi.fn(async () => new Response(null, { status: 200 })))).toBe('accepted');
  });

  it('rejects a definitive provider error', async () => {
    expect(await send(vi.fn(async () => new Response(null, { status: 412 })))).toBe('rejected');
  });

  it('keeps the code valid on transient provider errors', async () => {
    expect(await send(vi.fn(async () => new Response(null, { status: 503 })))).toBe('uncertain');
    expect(await send(vi.fn(async () => new Response(null, { status: 429 })))).toBe('uncertain');
  });

  it('keeps the code valid when the response is lost', async () => {
    expect(await send(vi.fn(async () => { throw new TypeError('network unavailable'); }))).toBe('uncertain');
  });
});
