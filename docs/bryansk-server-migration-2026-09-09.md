# Bryansk server clone (2026-09-09)

## Scope

An isolated copy of the frontend and self-hosted Supabase stack was prepared on
the Bryansk Ubuntu server. Production containers, DNS and the production
frontend were not changed.

## Installed layout

- Supabase compose project: `/opt/showdown-clone/supabase`
- Active frontend link: `/var/www/showdown-brn/current`
- Active frontend release: `/var/www/showdown-brn/releases/20260909-brn-same-origin`
- Previous frontend release: `/var/www/showdown-brn/releases/20260909-initial`
- Nginx site: `/etc/nginx/sites-available/brn-origin`
- Nginx enabled link: `/etc/nginx/sites-enabled/brn-origin`
- Intended public origin: `https://brn-origin.showdown-br.ru`

The frontend is compiled with that origin as its only Supabase endpoint. Client
fallback to the old API hostnames is disabled so this clone tests one network
route end to end.

## Database verification

The two PostgreSQL databases and global roles were restored from consistent
logical dumps. Ownership of `auth.schema_migrations` and `storage.migrations`
was preserved for their service roles. Source/target control counts matched:

| Relation | Rows |
| --- | ---: |
| `auth.users` | 26 |
| `public.users` | 66 |
| `public.tournaments` | 16 |
| `public.participants` | 174 |
| `public.transactions` | 39 |
| `public.logs` | 874 |
| `public.login_otp_requests` | 1 |
| `public.timer_sessions` | 2 |

All eleven Supabase containers remained healthy after restore. Local Nginx
checks returned HTTP 200 for the SPA, JavaScript, Auth settings and REST. The
OTP endpoint returned the expected HTTP 400 for an intentionally empty payload,
which confirms routing and origin validation without sending an email.

## External ingress blocker

The server has the private address `10.102.2.22`. Its observed public egress
address is `109.194.11.169`, but HTTP and HTTPS requests to that public address
are answered by a different Nginx instance with HTTP 404 and do not appear in
the clone's access log. The public gateway therefore does not yet forward the
test hostname to `10.102.2.22:80`.

Before changing DNS, configure the public gateway to terminate TLS for
`brn-origin.showdown-br.ru` and proxy HTTP/WebSocket traffic to
`10.102.2.22:80`. After that route passes health and mobile-network tests, a
separate cutover plan can be prepared. Do not point the production hostname at
the clone before data-write/synchronization behavior is explicitly decided.

### Cloudflare Tunnel experiment

A separate locally managed tunnel named `showdown-brn-canary` and a separate
published application for `brn-origin.showdown-br.ru` were created. No existing
production DNS record was changed. The connector repeatedly registered four
connections and passed Cloudflare's UDP, TCP and API pre-checks, but the
connections then disappeared. QUIC failed after several seconds with `no recent
network activity`; forced HTTP/2 survived longer but also disconnected and the
public hostname returned Cloudflare 502/1033 responses. Requests did not reach
the clone's Nginx access log.

The same failure occurred with the current `cloudflared` release and the prior
stable release, so a client-version regression was ruled out. The test connector
is installed but disabled and inactive. Its local configuration is preserved;
temporary token files and package downloads were removed. This points to the
Bryansk public gateway or upstream network path interfering with Tunnel traffic
on port 7844 rather than a failure in the cloned application.

The preferred next experiment is a conventional gateway route. The additive
site snippet is stored in `ops/nginx/brn-origin.gateway.conf`; it only proxies
the test hostname to `10.102.2.22:80`. Validate it with `nginx -t` on the public
gateway before reloading Nginx. Only after the gateway route works should the
test DNS record be changed from the disabled tunnel to the gateway's public IP.

## Rollback

The previous frontend is retained. Switching the `current` symlink back to
`20260909-initial` and reloading Nginx restores the initial clone build. The
production server is independent of this rollback.

The Cloudflare connector can be re-enabled with `systemctl enable --now
cloudflared`. It is not part of production traffic while the test hostname is
unused.

## Production-domain cutover prerequisite (2026-09-10)

The isolated clone passed HTTPS, OTP and application-function tests through
`brn-origin.showdown-br.ru`. A final production database snapshot was restored
on the Bryansk server and its control counts and application roles matched the
source. The main-domain frontend was built as a separate, inactive release at
`/var/www/showdown-brn/releases/20260910-main-cutover` with
`https://showdown-br.ru` as its only API origin.

The managed public forwarding rule is not yet bound to the main host: pre-DNS
`--resolve` checks return HTTP 404 and a certificate-name mismatch for
`showdown-br.ru`/`www.showdown-br.ru`. In the gateway control plane, bind both
main names to the same forwarding destination already used by the canary:
`10.102.2.22:80`. The gateway terminates TLS; the virtual machine intentionally
listens on HTTP port 80 only. Do not change DNS until strict HTTPS `--resolve`
health checks pass for both main names.

Because production was resumed after this blocked cutover attempt, take and
restore one fresh final database snapshot immediately before the eventual DNS
switch. Do not reuse the 2026-09-10 14:46 snapshot as the final source of truth.

## Production cutover completed (2026-09-10 17:15 MSK)

A fresh final snapshot was taken after stopping the old external Supabase
services and restored on the Bryansk server. The post-restore controls matched
the source: 27 Auth users, 66 profiles, 16 tournaments, 186 participants, 41
transactions, 897 log rows, two administrators, one SuperAdmin and 63 regular
users. All eleven target containers reported healthy.

The active frontend link now points to
`/var/www/showdown-brn/releases/20260910-main-cutover`. Auth uses
`https://showdown-br.ru` as its site URL while retaining the canary hostname as
an allowed recovery redirect. The authoritative, Cloudflare-managed DNS-only A
records for the apex and `www` were changed from `178.209.127.53` to the managed
gateway at `109.194.11.169` with a 300-second TTL.

Strict HTTPS checks passed for the apex and `www`; the SPA, all five startup
assets and Auth health endpoint returned HTTP 200 through the new gateway. The
served bundle contains the main same-origin API URL and no references to
`brn-origin.showdown-br.ru` or `direct-api.showdown-br.ru`.

The old server retains its healthy database container and protected final
backup, but all externally reachable Supabase services remain stopped to avoid
split-brain writes. Do not start those services unless performing a controlled
rollback. Temporary unprotected database archives were removed from the target
host and container after the protected backups were verified.
