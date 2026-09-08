# Blind structures synchronization storm — 2026-09-08

Status: diagnosed; remediation intentionally deferred.

## Observed production behaviour

- An authenticated Windows/Yandex Browser session generated roughly 19–20
  `club_save_blind_structures` calls per second.
- The rate reached approximately 1,100–1,200 writes per minute. Each RPC
  returned a roughly 25 KB snapshot, creating sustained database and network
  load while other clients were trying to start.
- 9,960 of a sampled 10,000 Nginx access-log entries came from that client.
- PostgreSQL reached about 61% CPU during the storm. Nginx did not report a
  corresponding application 5xx failure.
- The stored `blind-structures` revision had reached 1,348,934, confirming that
  the same logical document was being rewritten continuously.
- iPhone requests still arrived through the Cloudflare route. The origin
  returned successful account/directory responses, but subsequent requests
  often did not arrive. No production IPv6 client traffic was observed.

## Root cause

`BlindsProvider` writes the migration markers to local storage, but its
`storage` event listener reconstructs a snapshot without the `migrations`
field. With more than one tab open, each receiving tab treats the other tab's
snapshot as not migrated and publishes a new snapshot immediately. The tabs
then continuously trigger one another.

Relevant code: `src/context/BlindsContext.tsx`, the blind-structures
`onStorage` handler near line 482 and the `migrated.changed` publish path near
line 454.

## Planned remediation

1. Preserve and validate `migrations` in the storage-event snapshot.
2. Ignore structurally identical snapshots and coalesce queued saves.
3. Add a single-writer/tab-leader guard for background synchronization.
4. Add a server-side rate/idempotency guard for the save RPC.
5. Test two visible/hidden tabs and then repeat a long iPhone test without VPN.

Until remediation, keep only one `showdown-br.ru` tab open per browser profile.
