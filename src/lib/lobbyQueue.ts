/** Signup order. Seats without a server timestamp sort after everyone who has one. */
export function signupOrder<T extends { id: string; joinedAt?: string }>(players: readonly T[]): T[] {
  return [...players].sort((a, b) => {
    const at = a.joinedAt ?? '';
    const bt = b.joinedAt ?? '';
    if (at && bt && at !== bt) return at < bt ? -1 : 1;
    if (at !== bt) return at ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

/**
 * The first `totalSeats` signups take the field. Everyone after that stays
 * registered and is shown as the waitlist, in the order they signed up.
 */
export function splitLobbyQueue<T extends { id: string; joinedAt?: string }>(
  players: readonly T[],
  totalSeats: number,
): { field: T[]; queue: T[] } {
  const ordered = signupOrder(players);
  const cap = Number.isFinite(totalSeats) ? Math.max(0, Math.trunc(totalSeats)) : ordered.length;
  return { field: ordered.slice(0, cap), queue: ordered.slice(cap) };
}
