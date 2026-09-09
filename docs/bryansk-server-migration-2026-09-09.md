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

## Rollback

The previous frontend is retained. Switching the `current` symlink back to
`20260909-initial` and reloading Nginx restores the initial clone build. The
production server is independent of this rollback.
