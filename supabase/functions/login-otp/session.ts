/** No environment access or logging here. All credentials stay on the server. */
type SessionOptions = {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetchImpl?: typeof fetch;
};

export type VerifiedSession = {
  verified: true;
  session: { access_token: string; refresh_token: string };
} | { verified: false };

export async function verifyOtpAndIssueSession(
  options: SessionOptions, email: string, codeHash: string,
): Promise<VerifiedSession> {
  const request = options.fetchImpl ?? fetch;
  const base = options.supabaseUrl.replace(/\/$/, '');
  const signal = AbortSignal.timeout(10_000);
  const post = async (path: string, body: Record<string, unknown>): Promise<Response> => request(
    `${base}${path}`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', apikey: options.serviceRoleKey,
        Authorization: `Bearer ${options.serviceRoleKey}` },
      body: JSON.stringify(body),
    },
  );
  try {
    const check = await post('/rest/v1/rpc/verify_login_otp', { p_email: email, p_code_hash: codeHash });
    if (!check.ok) throw new Error();
    if (await check.json() !== 'verified') return { verified: false };

    // generate_link does not send email. Only issue it AFTER consuming the valid OTP.
    const link = await post('/auth/v1/admin/generate_link', { type: 'magiclink', email });
    if (!link.ok) throw new Error();
    const linkBody = await link.json() as { hashed_token?: unknown };
    if (typeof linkBody.hashed_token !== 'string' || !linkBody.hashed_token) throw new Error();
    const verified = await post('/auth/v1/verify', { type: 'email', token_hash: linkBody.hashed_token });
    if (!verified.ok) throw new Error();
    const body = await verified.json() as {
      access_token?: unknown; refresh_token?: unknown;
      user?: { id?: unknown; email?: string; role?: unknown; email_confirmed_at?: unknown };
    };
    if (typeof body.access_token !== 'string' || !body.access_token ||
        typeof body.refresh_token !== 'string' || !body.refresh_token ||
        !body.user?.id || body.user.role !== 'authenticated' || !body.user.email_confirmed_at ||
        body.user.email?.trim().toLowerCase() !== email.trim().toLowerCase()) throw new Error();
    return { verified: true, session: { access_token: body.access_token, refresh_token: body.refresh_token } };
  } catch {
    // Do not attach provider bodies, keys, email, OTP, tokens or original exceptions.
    throw new Error('Authentication temporarily unavailable');
  }
}
