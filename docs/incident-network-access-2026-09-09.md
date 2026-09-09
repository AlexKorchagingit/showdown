# Intermittent production access — 2026-09-09

Status: alternate-port experiment retired; Cloudflare HTTP/3 temporarily
disabled for an ISP compatibility test; both production API hostnames now use
the Cloudflare proxy; main frontend unchanged.

## User impact

- Users in Bryansk reported the problem across multiple ISPs, not only Beeline.
- The static application usually opens, while profile, shop, tournaments and
  other API-backed screens may stop loading after a short period.
- VPN access is consistently better, which points to a path-dependent issue.

## Evidence

- The production VM had normal memory, disk and load figures. Nginx, Docker and
  every Supabase container were healthy.
- The origin health request completed in about 10 ms on the VM.
- During the audit, the Cloudflare API route completed in roughly 0.36–0.44 s.
- The direct HTTPS route alternated between a TCP timeout and a successful
  response of roughly 0.14 s on the same client connection.
- The failure was reproduced from the affected desktop connection: 30 of 30
  direct HTTPS attempts timed out while the server observed only 19 incoming
  SYN packets.
- In a synchronized follow-up, all 10 client requests failed. The server saw
  seven SYN packets and emitted seven corresponding SYN-ACK packets, but the
  client completed no TCP handshake. This places the loss outside Nginx,
  Supabase and the VM firewall, on the network path in front of the origin.
- Minutes later, the main frontend, Cloudflare API and direct origin each
  completed 10 of 10 requests. The rapid recovery confirms an intermittent
  route rather than a deterministic application error.
- At 00:23–00:24 UTC, iPhone requests reproduced partial delivery: session
  refresh and current-account calls returned 200, then only the CORS preflights
  for wallet and finance reached Nginx. The corresponding POST requests never
  arrived. At 00:32 UTC the same preflight-without-request pattern occurred in
  desktop Edge. Nginx recorded no errors and every Supabase service was healthy.
- Russian probes in Moscow and Saint Petersburg reached direct TCP/HTTPS.
- A Vimpelcom (AS3216) probe in Moscow reached both direct and Cloudflare API
  routes. This rules out a permanent blanket Beeline block, but not intermittent
  filtering or routing problems affecting particular subscriber networks.
- The server firewall accepts inbound traffic; UFW is inactive. Both IPv4 and
  IPv6 are configured for the direct origin.
- The TimeWeb React application supports redirects but does not expose a true
  path-based upstream reverse proxy. Requests such as `/auth/v1/health` on the
  main frontend domain therefore return the SPA HTML rather than Supabase.

## Canary architecture

`https://direct-api.showdown-br.ru/` now serves an isolated React build. Its
standard Supabase paths (`/auth/v1`, `/rest/v1`, `/realtime/v1`, `/storage/v1`,
`/functions/v1`, `/graphql/v1`) remain reverse-proxied to the local Supabase
gateway. The browser therefore uses one HTTPS origin for HTML, JavaScript and
API calls.

## Alternate-port experiment

TLS port 8443 was tested as a no-cost way to distinguish port-specific
filtering from an IP-route failure. It initially completed 20 of 20 requests,
then failed 10 of 10 in the same window where direct port 443 also failed 10 of
10. On iPhone, HTML and the logo arrived before the route collapsed and the
JavaScript bundle never reached the device, producing a blank page. The test
listener was therefore retired and is not a production fallback.

## HTTP/3 compatibility test

Cloudflare responses advertised `Alt-Svc: h3`, while the local curl build (which
supports HTTP/1.1 but not HTTP/2 or HTTP/3) completed requests that Edge and the
iPhone WebView intermittently lost. Cloudflare documents this diagnostic for
ISP- or network-specific failures and recommends temporarily disabling HTTP/3
to isolate QUIC handling:

https://developers.cloudflare.com/ssl/troubleshooting/err-ssl-protocol-error/

HTTP/3 was disabled for the zone at 00:34 UTC. Five subsequent API responses
completed successfully and no longer contained an `Alt-Svc` header. HTTP/2,
TLS and WebSockets remain enabled. The change is reversible and must be judged
from affected Bryansk networks, including a sustained session rather than a
single page load.

The desktop connection became stable after this change. Fresh iPhone traffic
at 00:41–00:49 UTC also reached Nginx: session/account, wallet, tournament,
finance, directory and participant requests returned HTTP 200, and Realtime
connections upgraded with HTTP 101. Some groups still arrived several seconds
later or only after the UI retried, so the phone result was not yet considered
stable.

An `Alt-Svc: clear` response was added at the origin and as a scoped Cloudflare
response-header rule for `api.showdown-br.ru`. Cloudflare accepted the rule but
did not expose the header in external HTTP/1.1 responses, so this mechanism is
not relied on as the fix.

## Direct-route retirement

The deployed frontend still races `api.showdown-br.ru` against
`direct-api.showdown-br.ru` and retains the first probe that responds. This
could move an otherwise healthy mobile session from Cloudflare back to the
intermittent origin route. At 00:55 UTC both the A and AAAA DNS records for
`direct-api.showdown-br.ru` were changed from DNS-only to proxied. No frontend,
database or Supabase configuration changed.

After propagation, both advertised Cloudflare IPv4 addresses completed five
of five diagnostic HTTPS requests each in 0.33–0.58 seconds. The previous
origin address may remain in client and resolver caches for its old TTL; tests
should therefore use a fresh network session or wait for the cache to expire.

At 00:59:50 UTC, after the DNS change, a mobile client completed the full
startup batch: account, finance, wallet, directory and tournament RPCs plus the
participant query all returned HTTP 200 in the same second. Realtime upgraded
successfully with HTTP 101 nine seconds later. This is the first fully delivered
mobile startup batch observed after the route change; a sustained device test
is still required before declaring the incident closed.

The production frontend at `https://showdown-br.ru/` remains unchanged. The
canary release is still stored below `/var/www/showdown-origin/releases`, but
its hostname now traverses Cloudflare instead of testing the raw ISP-to-origin
path. The Nginx configuration was backed up before each activation.

## Application load finding

The earlier multi-tab blind-structure synchronization loop was a separate
application-level availability risk. A storage event dropped the migration
markers and made another admin tab publish the same migration again. The fix
parses storage payloads through a tested adapter that preserves the markers,
preventing the cross-tab rewrite loop.

## Validation before any main-domain cutover

1. Test the canary repeatedly from affected Bryansk mobile and home networks,
   including at least one 10–15 minute authenticated session.
2. Verify login, profile, shop, tournaments, timer and an admin read-only screen.
3. Confirm normal request rate and database CPU during the test.
4. Only then consider moving the main frontend to the origin. DNS must not be
   changed until rollback and certificate handling are prepared.

## Rollback

The pre-canary Nginx configuration is stored at:

`/etc/nginx/sites-available/api.showdown-br.ru.bak-20260908-2305-origin-canary`

The configuration immediately before the origin `Alt-Svc: clear` header is:

`/etc/nginx/sites-available/api.showdown-br.ru.bak-20260909-altsvc-clear`

Restoring that file over the active virtual host, validating with `nginx -t`,
and reloading Nginx returns `direct-api.showdown-br.ru` to API-only behavior.
To restore the raw-origin network experiment, both the A and AAAA
`direct-api.showdown-br.ru` records must also be changed from proxied to
DNS-only in Cloudflare. That rollback reintroduces the confirmed ISP-path risk
and should not be used for production clients.
