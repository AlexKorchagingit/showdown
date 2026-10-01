# OTP delivery incident — 2026-10-01/02

## Evidence

- On 1 October around 21:08–21:11 Moscow time, the Bryansk Nginx access log
  showed seven OTP requests: five HTTP 500, one 429, and one client disconnect.
- The Edge Runtime reported `wall clock duration reached` and
  `request has been cancelled by supervisor`. OTP issue records existed in
  Postgres, but the mail provider had not received corresponding requests.
- The Bryansk host's default resolver returned EmailJS addresses that timed
  out from that network. Resolvers 9.9.9.9 and 208.67.222.222 returned
  reachable addresses; the same host reached EmailJS over HTTPS in under a
  second when using one of those addresses.
- The global OTP issue limit is necessary for the EmailJS one-request-per-second
  limit. A rejected concurrent request had no code issued, but the client
  previously displayed the code-entry screen and said a code was sent.

## Mitigation

- The production Compose `functions` service uses the DNS override in
  [production-functions-dns.override.yml](../supabase/production-functions-dns.override.yml).
  Production `.env` sets `COMPOSE_FILE`; both the base and override filenames
  must be listed there or the override is silently ignored. No other service's
  DNS was changed.
- The EmailJS request has a seven-second timeout. A definitive provider 4xx
  cancels the unused OTP; a timeout, network failure, 408, 429, or 5xx preserves
  it because delivery may have occurred even if the response was lost.
- The client distinguishes email, network, and global rate limits. It retries
  the short global limit twice with jitter. It never claims a code was sent
  after a global or IP limit. An uncertain delivery offers code entry without
  claiming success.

## Verification and rollback

The Edge Functions container was healthy after the scoped restart. Inside it,
EmailJS resolved to reachable addresses and the internal `api-gw` hostname
still resolved. Local Nginx returned HTTP 204 for OTP preflight and HTTP 400
for an invalid OTP request. This does not prove end-to-end mail delivery:
monitor real delivery and provider events after release.

To roll back the function logic, restore
`/opt/showdown-clone/supabase/volumes/functions/login-otp/index.ts.pre-otp-fix-20261002`
to `index.ts` and restart only `functions`. The DNS override can be removed
from `COMPOSE_FILE` and the service recreated, but doing so would restore the
observed unreachable provider addresses; use that only if the override itself
causes a new failure. The previous production `.env` is stored mode 0600 in
the same directory as `.env.pre-otp-dns-20261002`. Do not copy or print it.
