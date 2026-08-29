import { codeFromRandomBytes, isAllowedOrigin, normalizeCode, normalizeEmail } from './logic.ts';

const SUPABASE_URL = requiredEnv('SUPABASE_URL').replace(/\/$/, '');
const SERVICE_ROLE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const OTP_HASH_SECRET = requiredEnv('OTP_HASH_SECRET');
const EMAILJS_SERVICE_ID = requiredEnv('EMAILJS_SERVICE_ID');
const EMAILJS_TEMPLATE_ID = requiredEnv('EMAILJS_TEMPLATE_ID');
const EMAILJS_PUBLIC_KEY = requiredEnv('EMAILJS_PUBLIC_KEY');
const ALLOWED_ORIGINS = (Deno.env.get('OTP_ALLOWED_ORIGINS') || 'https://showdown-br.ru')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const encoder = new TextEncoder();
const hmacKey = await crypto.subtle.importKey(
  'raw',
  encoder.encode(OTP_HASH_SECRET),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign'],
);

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function response(origin: string, status: number, body: Record<string, unknown>, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Max-Age': '86400',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
      ...extraHeaders,
    },
  });
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const raw = await req.text();
  if (!raw || raw.length > 2048) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

async function hmac(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomCode(): string {
  return codeFromRandomBytes(crypto.getRandomValues(new Uint8Array(4)));
}

function clientAddress(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded || req.headers.get('x-real-ip') || 'unknown').slice(0, 128);
}

async function rpc(name: string, params: Record<string, unknown>): Promise<string> {
  const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(params),
  });
  if (!result.ok) {
    console.error(`OTP RPC ${name} failed with status ${result.status}`);
    throw new Error('OTP storage unavailable');
  }
  return await result.json() as string;
}

async function sendEmail(email: string, code: string): Promise<boolean> {
  const result = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://showdown-br.ru',
    },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: { to_email: email, code },
    }),
  });
  if (!result.ok) {
    console.error(`Email provider rejected OTP with status ${result.status}`);
  }
  return result.ok;
}

async function requestCode(req: Request, origin: string, payload: Record<string, unknown>) {
  const email = normalizeEmail(payload.email);
  if (!email) return response(origin, 400, { error: 'invalid_input' });

  const code = randomCode();
  const codeHash = await hmac(`otp:${email}:${code}`);
  const ipHash = await hmac(`ip:${clientAddress(req)}`);
  const issueStatus = await rpc('issue_login_otp', {
    p_email: email,
    p_code_hash: codeHash,
    p_ip_hash: ipHash,
  });

  if (issueStatus !== 'issued') {
    const retryAfter = issueStatus === 'global_rate_limited' ? '2' : '60';
    return response(origin, 429, { error: 'rate_limited' }, { 'Retry-After': retryAfter });
  }

  try {
    if (!await sendEmail(email, code)) {
      await rpc('cancel_login_otp', { p_email: email, p_code_hash: codeHash });
      return response(origin, 502, { error: 'delivery_failed' });
    }
  } catch (error) {
    console.error('OTP email request failed', error instanceof Error ? error.name : 'unknown');
    await rpc('cancel_login_otp', { p_email: email, p_code_hash: codeHash }).catch(() => undefined);
    return response(origin, 502, { error: 'delivery_failed' });
  }

  return response(origin, 202, { accepted: true });
}

async function verifyCode(origin: string, payload: Record<string, unknown>) {
  const email = normalizeEmail(payload.email);
  const code = normalizeCode(payload.code);
  if (!email || !code) return response(origin, 400, { verified: false });

  const codeHash = await hmac(`otp:${email}:${code}`);
  const verifyStatus = await rpc('verify_login_otp', { p_email: email, p_code_hash: codeHash });
  if (verifyStatus === 'verified') return response(origin, 200, { verified: true });
  return response(origin, 400, { verified: false });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (!isAllowedOrigin(origin, ALLOWED_ORIGINS)) {
    return new Response(JSON.stringify({ error: 'forbidden_origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  if (req.method === 'OPTIONS') return response(origin, 204, {});
  if (req.method !== 'POST') return response(origin, 405, { error: 'method_not_allowed' });

  const payload = await readJson(req);
  if (!payload) return response(origin, 400, { error: 'invalid_input' });

  try {
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    if (path.endsWith('/request')) return await requestCode(req, origin, payload);
    if (path.endsWith('/verify')) return await verifyCode(origin, payload);
    return response(origin, 404, { error: 'not_found' });
  } catch (error) {
    console.error('OTP endpoint failed', error instanceof Error ? error.name : 'unknown');
    return response(origin, 503, { error: 'unavailable' });
  }
});
