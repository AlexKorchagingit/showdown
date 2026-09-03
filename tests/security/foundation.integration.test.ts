import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { localSql } from '../../scripts/security-local.mjs';
import { verifyOtpAndIssueSession } from '../../supabase/functions/login-otp/session';
import { createOtpClient } from '../../src/lib/otpApi';

const base = 'http://127.0.0.1:55430';
const testSigningKey = 'showdown-local-test-signing-key-never-use-in-production';
const prefix = `test-${randomUUID()}`;
const id = (name: string) => `${prefix}-${name}`;
const email = (name: string) => `${id(name)}@example.test`;
const migration = () => readFileSync('supabase/migrations/20260903_auth_foundation.sql', 'utf8');

function token(role: string, overrides: Record<string, unknown> = {}) {
  const encode = (data: object) => Buffer.from(JSON.stringify(data)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ role, aud: 'authenticated', iss: 'supabase',
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...overrides });
  return `${header}.${payload}.${createHmac('sha256', testSigningKey).update(`${header}.${payload}`).digest('base64url')}`;
}
const serviceKey = token('service_role');
const anonKey = token('anon');
async function request(path: string, accessToken: string, body?: object, method = 'POST') {
  const options: RequestInit = { method, headers: { 'Content-Type': 'application/json',
    apikey: anonKey, Authorization: `Bearer ${accessToken}` } };
  if (body && method !== 'GET' && method !== 'HEAD') options.body = JSON.stringify(body);
  return fetch(`${base}${path}`, options);
}
async function signIn(name: string) {
  localSql(`insert into public.login_otp_requests(email,code_hash,request_ip_hash,expires_at)
    values ('${email(name)}','synthetic-hmac','synthetic-ip',now()+interval '5 minutes')
    on conflict (email) do update set code_hash='synthetic-hmac',attempt_count=0,expires_at=excluded.expires_at;`);
  const result = await verifyOtpAndIssueSession({ supabaseUrl: base, serviceRoleKey: serviceKey }, email(name), 'synthetic-hmac');
  expect(result.verified).toBe(true);
  if (!result.verified) throw new Error('Synthetic sign-in failed');
  return result.session;
}
async function open(accessToken: string, accept = false) {
  const res = await request('/rest/v1/rpc/club_open_session', accessToken, { p_accept_agreements: accept });
  expect(res.status).toBe(200);
  return res.json();
}

describe('isolated PostgreSQL + GoTrue + PostgREST: identity and role foundation', () => {
  let adminToken = '';
  let userToken = '';
  let ownerToken = '';
  beforeAll(async () => {
    expect((await fetch(`${base}/auth/v1/health`)).status).toBe(200);
    localSql(readFileSync('tests/security/auth-helpers.sql', 'utf8'));
    localSql(readFileSync('supabase/schema.sql', 'utf8'));
    localSql(readFileSync('supabase/migrations/20260829_login_otp.sql', 'utf8'));
    localSql(`insert into public.users(id,email,nickname,is_admin,ruby_balance) values
      ('${id('admin')}','${email('admin')}','Synthetic admin',true,2345),
      ('${id('admin2')}','${email('admin2')}','Synthetic second admin',true,3456),
      ('${id('owner')}','${email('owner')}','Synthetic owner',true,4567),
      ('${id('user')}','${email('user')}','Synthetic user',false,5678);`);
    localSql(migration());
    localSql(migration());
    // Test fixture only: this never selects or assigns a real production owner.
    localSql(`update club_private.profile_roles set role='superadmin' where user_id='${id('owner')}';`);
    // A request refreshes PostgREST's schema cache after NOTIFY; bounded retry only.
    for (let attempt = 0; attempt < 20; attempt++) {
      const res = await request('/rest/v1/rpc/club_current_account', anonKey, {});
      if (res.status !== 404) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });

  it('preserves original profile IDs, three admin flags and all balances across reruns', () => {
    const result = localSql(`select count(*),count(*) filter(where is_admin),sum(ruby_balance)
      from public.users where id like '${prefix}%';`);
    expect(result).toBe('4|3|16046');
  });
  it('denies anonymous calls to every new account/role RPC', async () => {
    for (const [name, args] of [
      ['club_current_account', {}], ['club_open_session', { p_accept_agreements: true }],
      ['club_directory', {}],
      ['club_set_role', { p_user_id: id('user'), p_role: 'admin' }],
    ] as const) {
      const res = await request(`/rest/v1/rpc/${name}`, anonKey, args);
      expect([401, 403].includes(res.status)).toBe(true);
    }
  });
  it('rejects an invalid OTP without creating an Auth account', async () => {
    const result = await verifyOtpAndIssueSession({ supabaseUrl: base, serviceRoleKey: serviceKey }, email('invalid'), 'wrong');
    expect(result.verified).toBe(false);
    expect(localSql(`select count(*) from auth.users where email='${email('invalid')}';`)).toBe('0');
  });
  it('exchanges a valid OTP for Auth tokens and binds the original admin profile', async () => {
    const session = await signIn('admin');
    adminToken = session.access_token;
    const result = await open(adminToken);
    expect(result.user.id).toBe(id('admin'));
    expect(result.user.role).toBe('admin');
    expect(result.user.ruby_balance).toBe(2345);
    expect(result.is_new).toBe(false);
    const replay = await verifyOtpAndIssueSession({ supabaseUrl: base, serviceRoleKey: serviceKey }, email('admin'), 'synthetic-hmac');
    expect(replay.verified).toBe(false);
  });
  it('rejects a correctly signed but expired access token', async () => {
    const sub = JSON.parse(Buffer.from(adminToken.split('.')[1], 'base64url').toString()).sub;
    const res = await request('/rest/v1/rpc/club_current_account', token('authenticated', { sub, exp: 1 }), {});
    expect(res.status).toBe(401);
  });
  it('denies a banned account even while its previously issued JWT is still valid', async () => {
    localSql(`update auth.users set banned_until=now()+interval '1 hour' where email='${email('admin')}';`);
    try {
      const res = await request('/rest/v1/rpc/club_open_session', adminToken, { p_accept_agreements: false });
      expect(res.status).toBe(403);
      const own = await request('/rest/v1/rpc/club_current_account', adminToken, {});
      expect(await own.json()).toBeNull();
    } finally {
      localSql(`update auth.users set banned_until=null where email='${email('admin')}';`);
    }
  });
  it('binds an ordinary user and ignores attempted role escalation through user metadata', async () => {
    const session = await signIn('user');
    userToken = session.access_token;
    const metadata = await request('/auth/v1/user', userToken, { data: { role: 'superadmin', is_admin: true } }, 'PUT');
    expect(metadata.status).toBe(200);
    const result = await open(userToken);
    expect(result.user.id).toBe(id('user'));
    expect(result.user.role).toBe('user');
    expect(result.user.is_admin).toBe(false);
  });
  it('makes simultaneous repeated binding idempotent', async () => {
    const results = await Promise.all([open(adminToken), open(adminToken), open(adminToken)]);
    expect(results.every((value) => value.user.id === id('admin'))).toBe(true);
    expect(localSql(`select count(*) from club_private.auth_links where user_id='${id('admin')}';`)).toBe('1');
  });
  it('redacts other profiles in the member directory on the server', async () => {
    const res = await request('/rest/v1/rpc/club_directory', userToken, {});
    expect(res.status).toBe(200);
    const rows = await res.json();
    const other = rows.find((row: { id: string }) => row.id === id('admin'));
    expect(other.email).toBe('');
    expect(other.birth_date).toBe('');
    expect(other.ruby_balance).toBe(0);
    expect(other.pending_notifications).toEqual([]);
    const self = rows.find((row: { id: string }) => row.id === id('user'));
    expect(self.ruby_balance).toBe(5678);
  });
  it('keeps the role and identity tables inaccessible to client roles', () => {
    expect(localSql(`select has_schema_privilege('authenticated','club_private','USAGE'),
      has_table_privilege('authenticated','club_private.profile_roles','INSERT,UPDATE,DELETE'),
      has_table_privilege('anon','club_private.auth_links','SELECT,INSERT,UPDATE,DELETE');`)).toBe('f|f|f');
  });
  it('does not accept client-supplied email or profile ID as identity', async () => {
    const res = await request('/rest/v1/rpc/club_open_session', userToken,
      { p_accept_agreements: false, p_email: email('admin'), p_user_id: id('admin') });
    expect(res.status).toBe(404);
    const account = await request('/rest/v1/rpc/club_current_account', userToken, {});
    expect((await account.json()).id).toBe(id('user'));
  });
  it('does not let an ordinary user or admin change roles', async () => {
    for (const access of [userToken, adminToken]) {
      const res = await request('/rest/v1/rpc/club_set_role', access, { p_user_id: id('user'), p_role: 'admin' });
      expect(res.status).toBe(403);
    }
  });
  it('lets the synthetic SuperAdmin change roles and records the real actor atomically', async () => {
    ownerToken = (await signIn('owner')).access_token;
    expect((await open(ownerToken)).user.role).toBe('superadmin');
    const res = await request('/rest/v1/rpc/club_set_role', ownerToken, { p_user_id: id('user'), p_role: 'admin' });
    expect(res.status).toBe(200);
    expect((await res.json()).role).toBe('admin');
    expect(localSql(`select count(*) from public.logs where admin_id='${id('owner')}'
      and target_user_id='${id('user')}' and action_type='Изменение роли';`)).toBe('1');
  });
  it('protects the SuperAdmin from demotion and does not expose a SuperAdmin assignment API', async () => {
    const demote = await request('/rest/v1/rpc/club_set_role', ownerToken, { p_user_id: id('owner'), p_role: 'user' });
    expect(demote.status).toBe(403);
    const promote = await request('/rest/v1/rpc/club_set_role', ownerToken, { p_user_id: id('admin'), p_role: 'superadmin' });
    expect(promote.status).toBe(400);
    localSql(migration());
    expect((await open(ownerToken)).user.role).toBe('superadmin');
  });
  it('requires consent for a new profile, creates it as user and does not duplicate it', async () => {
    const session = await signIn('new');
    expect((await open(session.access_token)).status).toBe('consent_required');
    expect(localSql(`select count(*) from public.users where email='${email('new')}';`)).toBe('0');
    const result = await open(session.access_token, true);
    expect(result.is_new).toBe(true);
    expect(result.user.role).toBe('user');
    expect(result.user.is_admin).toBe(false);
    expect(result.user.ruby_balance).toBe(1500);
    expect((await open(session.access_token, true)).is_new).toBe(false);
  });
  it('refuses ambiguous legacy email profiles without merging or changing balances', async () => {
    localSql(`insert into public.users(id,email,nickname,ruby_balance) values
      ('${id('duplicate1')}','${email('duplicate')}','Synthetic duplicate',12),
      ('${id('duplicate2')}','${email('duplicate').toUpperCase()}','Synthetic duplicate',34);`);
    const session = await signIn('duplicate');
    const res = await request('/rest/v1/rpc/club_open_session', session.access_token, { p_accept_agreements: true });
    expect(res.status).toBe(400);
    expect(localSql(`select count(*),sum(ruby_balance) from public.users
      where lower(email)='${email('duplicate')}';`)).toBe('2|46');
  });
  it('refreshes and invalidates a real refresh token on logout', async () => {
    const session = await signIn('admin2');
    const refreshed = await request('/auth/v1/token?grant_type=refresh_token', anonKey,
      { refresh_token: session.refresh_token });
    expect(refreshed.status).toBe(200);
    const next = await refreshed.json();
    const logout = await request('/auth/v1/logout?scope=local', next.access_token);
    expect(logout.status).toBe(204);
    const stale = await request('/auth/v1/token?grant_type=refresh_token', anonKey, { refresh_token: next.refresh_token });
    expect(stale.status).toBe(400);
  });

  it('runs the real OTP handler and client through consent, profile creation, restoration and logout', async () => {
    const origin = 'http://127.0.0.1:5173';
    const nativeLocalFetch = globalThis.fetch;
    let handler!: (req: Request) => Promise<Response>;
    let deliveredCode = '';
    const testEnv: Record<string, string> = {
      SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      OTP_HASH_SECRET: 'synthetic-otp-hmac-secret', OTP_ALLOWED_ORIGINS: origin,
      EMAILJS_SERVICE_ID: 'synthetic', EMAILJS_TEMPLATE_ID: 'synthetic', EMAILJS_PUBLIC_KEY: 'synthetic',
    };
    const storage = new Map<string, string>();
    const authOptions = { storageKey: 'showdown.auth.session', autoRefreshToken: false,
      persistSession: true, detectSessionInUrl: false,
      storage: { getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => { storage.set(key, value); },
        removeItem: (key: string) => { storage.delete(key); } } };
    const client = createClient(base, anonKey, { auth: authOptions });
    let restored: ReturnType<typeof createClient> | undefined;
    try {
      vi.stubGlobal('Deno', {
        env: { get: (key: string) => testEnv[key] },
        serve: (callback: typeof handler) => { handler = callback; },
      });
      vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
        if (input.toString() === 'https://api.emailjs.com/api/v1.0/email/send') {
          // Intercept delivery entirely: no email or request leaves this device.
          const payload = JSON.parse(init?.body as string);
          expect(payload.template_params.to_email === email('edge')).toBe(true);
          deliveredCode = payload.template_params.code;
          return new Response('OK', { status: 200 });
        }
        return nativeLocalFetch(input, init);
      });
      await import('../../supabase/functions/login-otp/index');
      const preflight = await handler(new Request(`${base}/functions/v1/login-otp/verify`,
        { method: 'OPTIONS', headers: { Origin: origin } }));
      expect(preflight.status).toBe(204);
      expect(await preflight.text()).toBe('');
      const forbidden = await handler(new Request(`${base}/functions/v1/login-otp/request`,
        { method: 'POST', headers: { Origin: 'https://untrusted.example.test' }, body: '{}' }));
      expect(forbidden.status).toBe(403);
      const otp = createOtpClient({ baseUrl: base, anonKey,
        fetchImpl: (input, init) => {
          const headers = new Headers(init?.headers);
          headers.set('Origin', origin);
          return handler(new Request(input, { ...init, headers }));
        },
        storeSession: async (session) => {
          const result = await client.auth.setSession(session);
          expect(Boolean(result.error)).toBe(false);
        },
      });
      await otp.requestCode(email('edge'));
      expect(/^\d{4}$/.test(deliveredCode)).toBe(true);
      expect(await otp.verifyCode(email('edge'), deliveredCode)).toBe(true);
      const consent = await client.rpc('club_open_session', { p_accept_agreements: false });
      expect(consent.data?.status).toBe('consent_required');
      const profile = await client.rpc('club_open_session', { p_accept_agreements: true });
      expect(profile.data?.status).toBe('ready');
      expect(profile.data?.user.role).toBe('user');
      expect(profile.data?.user.is_admin).toBe(false);
      restored = createClient(base, anonKey, { auth: authOptions });
      const restoredSession = await restored.auth.getSession();
      expect(Boolean(restoredSession.data.session)).toBe(true);
      const own = await restored.rpc('club_current_account');
      expect(own.data?.id === profile.data?.user.id).toBe(true);
      const loggedOut = await restored.auth.signOut({ scope: 'local' });
      expect(Boolean(loggedOut.error)).toBe(false);
      expect(storage.has('showdown.auth.session')).toBe(false);
    } finally {
      client.auth.stopAutoRefresh();
      restored?.auth.stopAutoRefresh();
      vi.unstubAllGlobals();
      globalThis.fetch = nativeLocalFetch;
    }
  });
});
