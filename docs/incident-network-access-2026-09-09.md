# Intermittent production access — 2026-09-09

Status: network-path failure confirmed; the production API now has two
independent routes. `api.showdown-br.ru` uses the existing TimeWeb load
balancer over HTTP/1.1, while `direct-api.showdown-br.ru` remains behind
Cloudflare as the fallback. The deterministic client failover fix was deployed
to the main frontend in commit `3015331`. Desktop access became stable, but the
affected phone still intermittently loses the startup batch.

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
- An existing TimeWeb load balancer was found in the account. Ten consecutive
  API health requests through it completed in about 0.08–0.26 seconds without
  creating or purchasing another service.

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

## Independent production routes

The temporary state where both API hostnames traversed Cloudflare did not give
the browser a real fallback. `api.showdown-br.ru` was therefore changed to a
DNS-only A record for the existing TimeWeb load balancer at `185.84.162.192`.
Its certificate and forwarding configuration were already valid for the API
hostname. `direct-api.showdown-br.ru` remains proxied by Cloudflare, so the two
hostnames now use different public network paths.

Nginx exposes a side-effect-free `GET /__health` endpoint on both public API
hostnames and on the TimeWeb listener. Ten consecutive requests through the
TimeWeb route completed in about 0.09–0.15 seconds. Separate access logs were enabled
for the origin, Cloudflare fallback and TimeWeb load-balancer listener, without
recording authorization headers, request bodies or URL query parameters.

Backups immediately before these Nginx changes are stored at:

- `/etc/nginx/sites-available/api.showdown-br.ru.bak-20260909-health-probe`
- `/etc/nginx/sites-available/api.showdown-br.ru.bak-20260909-split-logs`
- `/etc/nginx/sites-available/api.showdown-br.ru.bak-20260909-safe-log`
- `/etc/nginx/sites-available/api.showdown-br.ru.bak-20260909-health-all-routes`

## Morning startup correlation and client fix

Repeated morning tests showed an all-or-nothing pattern: a successful startup
immediately loaded account, wallet, directory, tournaments and participants;
an unsuccessful startup produced only the route probe and no corresponding
application batch. Both independent routes delivered complete response bodies
when selected successfully, and Supabase, Nginx and the VM remained healthy.

The deployed client races lightweight `/auth/v1/settings` probes, permanently
selects the first response, then gives each real request a six-second timeout.
On failure it performs another probe before attempting the alternate route.
That sequence can consume almost the entire ten-second startup budget, while a
probe response does not prove that the larger authenticated request will pass.
Concurrent startup requests can also overwrite the chosen route with a late
response. This matches the observed result: once the first route decision is
good, every screen works; when it is bad, every screen fails together.

The incident branch changes safe reads and refresh recovery to use the TimeWeb
route immediately and then try the Cloudflare route directly on a network
timeout or transient gateway response. It does not repeat writes or
administrative commands. The successful route remains sticky for subsequent
requests, and late parallel responses cannot switch the application back to a
route that has already failed. Per-route timeouts were reduced to four seconds
so both paths fit within the startup limit. The change passed 205 automated
tests, lint, the production build and the Android 8/9/10/modern WebView build
matrix before its approved deployment in commit `3015331`.

## Application load finding

The earlier multi-tab blind-structure synchronization loop was a separate
application-level availability risk. A storage event dropped the migration
markers and made another admin tab publish the same migration again. The fix
parses storage payloads through a tested adapter that preserves the markers,
preventing the cross-tab rewrite loop.

## Same-origin mobile canary refresh

Post-deployment iPhone traffic confirmed that the new fallback is active: when
the TimeWeb route does not finish, the Cloudflare route receives the safe reads
about four seconds later. Nginx and Supabase then return complete HTTP 200
response bodies for account, wallet, tournament, finance, directory and
participants. The phone can still remain on incomplete UI despite those origin
responses. This keeps the remaining fault on the browser-to-edge delivery path
and makes the separate frontend/API origins, CORS preflights and parallel
mobile connections the next variables to remove.

The isolated same-origin canary at `https://direct-api.showdown-br.ru/` was
refreshed from production commit `3015331`. Its build uses that same hostname
for HTML, JavaScript, Auth, REST, Realtime, Storage, Functions and GraphQL, so
normal application requests do not require cross-origin preflights. The change
only replaced the canary's static files; the production frontend, API protocol
paths, database and roles were not changed. The previous canary release remains
available for an atomic symlink rollback.

The affected phone could not open the refreshed Cloudflare canary at all, even
though desktop checks completed normally. This rules out using Cloudflare as a
universal delivery path for the affected mobile networks.

## TimeWeb same-origin canary

A second same-origin canary is served from `https://api.showdown-br.ru/` through
the existing TimeWeb load balancer. The established Supabase protocol paths on
that hostname are still proxied to the same local gateway; only the root and
SPA routes now serve the isolated frontend build. This adds no new service or
tariff.

The canary build sets `api.showdown-br.ru` as its own Supabase origin and
explicitly disables browser-side fallback to another hostname. That removes
CORS preflights and keeps HTML, JavaScript, Auth, REST, Realtime, Storage,
Functions and GraphQL on one browser connection path. The configuration has an
atomic release symlink and an Nginx backup at
`/etc/nginx/sites-available/api.showdown-br.ru.bak-20260909-timeweb-same-origin`.

After activation, the root, JavaScript bundle, health endpoint, Auth settings,
direct SPA routes for tournaments/rating/profile/shop, the production frontend
and the Cloudflare fallback health endpoint all returned HTTP 200. The login
screen also rendered without new console warnings or errors. A sustained test
from the affected phone is still required before any main-domain cutover.

## Validation before any main-domain cutover

1. Test the canary repeatedly from affected Bryansk mobile and home networks,
   including at least one 10–15 minute authenticated session.
2. Verify login, profile, shop, tournaments, timer and an admin read-only screen.
3. Confirm normal request rate and database CPU during the test.
4. Only then consider moving the main frontend to the origin. DNS must not be
   changed until rollback and certificate handling are prepared.

## Emergency DNS bypass and iOS 26 trace

When the TimeWeb load balancer stopped accepting TCP/HTTPS connections,
`api.showdown-br.ru` was changed from the unavailable balancer to the origin
server. The record is DNS-only and resolves to the origin from Cloudflare,
Google and Yandex resolvers. Ten direct-origin checks and a distributed
twelve-node check, including a Russian node, returned HTTP 200. The old load
balancer address remains the DNS rollback value.

The 443 virtual host now serves the existing `api.showdown-br.ru` same-origin
build directly. Nginx validated the candidate before reload and kept the
previous configuration at
`/etc/nginx/sites-available/api.showdown-br.ru.bak-20260909-direct-same-origin`.
This changes neither Supabase data nor the production frontend hostname.

The first two-device comparison separated the clients by their reported iOS
versions. The iOS 18.7 client completed authentication and all startup reads;
account, wallet, finance, tournaments, directory and participants returned
HTTP 200. The iOS 26.6.1 client executed JavaScript and completed OTP
verification, but stopped after the CORS preflight for `club_open_session`.
No matching RPC POST followed. OTP request responses on that route took
4.26--4.93 seconds at the origin, while the browser route deadline is four
seconds. There were no Nginx or Supabase errors.

This creates two actionable application changes without weakening server-side
authorization: use a longer deadline for non-replayable OTP/session-opening
writes while preserving the four-second failover deadline for safe reads, and
recover an uncertain `club_open_session` response with the read-only
`club_current_account` RPC instead of repeating the mutation. The raw timeout
message should also be mapped to the existing localized network error.

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
