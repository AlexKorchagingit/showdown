# Blind structures synchronization storm — 2026-09-08

Status: client remediation implemented on `fix/bryansk-network-gateway`;
production deployment pending canary validation.

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

## Remediation

1. Implemented: preserve and validate `migrations` in the storage-event
   snapshot through `parseBlindStructuresStorageSnapshot`.
2. Implemented: add regression coverage for valid and malformed storage-event
   payloads. With the migration marker intact, receiving tabs apply the newer
   revision without publishing the migration again.
3. Pending hardening: add a server-side rate/idempotency guard for the save RPC.
4. Pending validation: test two visible/hidden admin tabs and then repeat a long
   iPhone test without VPN.

Until remediation, keep only one `showdown-br.ru` tab open per browser profile.
