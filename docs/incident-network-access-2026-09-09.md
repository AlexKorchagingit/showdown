# Intermittent production access — 2026-09-09

Status: origin canary active; alternate-port experiment retired; main frontend
unchanged.

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

The production frontend at `https://showdown-br.ru/` and the Cloudflare-facing
API host remain unchanged. The active canary release is stored below
`/var/www/showdown-origin/releases`, and the Nginx configuration was backed up
before activation.

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

Restoring that file over the active virtual host, validating with `nginx -t`,
and reloading Nginx returns `direct-api.showdown-br.ru` to API-only behavior.
