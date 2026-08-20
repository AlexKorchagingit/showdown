const LEGACY_AUDIT_KEYS = ['club_audit_logs', 'AUDIT_LOG_STORAGE_KEY'] as const;

/** Drop the pre-Supabase in-memory journal so Admin Logs cannot show ghost rows. */
export function purgeLegacyAuditJournal(): void {
  try {
    for (const key of LEGACY_AUDIT_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    /* private mode */
  }
}

export function unregisterStaleServiceWorkers(): void {
  if (!('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) void registration.unregister();
  });
}
