export type DrawPlayer = { id: string; nickname: string };

export type DrawSettings = {
  /** How many names one flip should reveal. */
  count: number;
  /** Cashier seat ids left out of the draw. */
  excluded: string[];
};

const STORAGE_KEY = 'showdown.timer-draw.v1';

export function defaultDrawSettings(): DrawSettings {
  return { count: 1, excluded: [] };
}

function readStore(): Record<string, DrawSettings> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, DrawSettings>;
  } catch {
    return {};
  }
}

export function readDrawSettings(tournamentId: string): DrawSettings {
  const row = readStore()[tournamentId];
  if (!row) return defaultDrawSettings();
  const count = Math.trunc(Number(row.count));
  const excluded = Array.isArray(row.excluded)
    ? row.excluded.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];
  return { count: Number.isFinite(count) && count >= 1 ? count : 1, excluded };
}

export function writeDrawSettings(tournamentId: string, settings: DrawSettings): void {
  if (!tournamentId) return;
  try {
    const store = readStore();
    store[tournamentId] = {
      count: Math.max(1, Math.trunc(settings.count) || 1),
      excluded: [...new Set(settings.excluded)],
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* private mode */
  }
}

/** People still eligible for the draw, in cashier order, without duplicates. */
export function eligibleDrawPlayers(players: readonly DrawPlayer[], excluded: readonly string[]): DrawPlayer[] {
  const skip = new Set(excluded);
  const seen = new Set<string>();
  const out: DrawPlayer[] = [];
  for (const player of players) {
    const id = player.id.trim();
    if (!id || skip.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, nickname: player.nickname.trim() || id });
  }
  return out;
}

/**
 * Shuffle the eligible cashier seats and take `count` of them.
 * The count is capped by how many people are left in the pool.
 */
export function drawRandomPlayers(
  players: readonly DrawPlayer[],
  excluded: readonly string[],
  count: number,
  random: () => number = Math.random,
): DrawPlayer[] {
  const pool = eligibleDrawPlayers(players, excluded);
  const wanted = Math.max(0, Math.min(pool.length, Math.trunc(count) || 0));
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = pool[index]!;
    pool[index] = pool[swap]!;
    pool[swap] = current;
  }
  return pool.slice(0, wanted);
}
