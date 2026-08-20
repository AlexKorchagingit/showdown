import {
  ACHIEVEMENTS,
  type Achievement,
  type AchievementProgress,
} from '../data/achievements';

function normalizeKey(userKey: string): string {
  return userKey.trim().toLowerCase();
}

export function achievementsStorageKey(userKey: string): string {
  return `achievements_${normalizeKey(userKey)}`;
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

/** Seed from the catalogue defaults (stats-backed demo progress). */
export function createDefaultAchievementProgress(): Record<string, AchievementProgress> {
  const map: Record<string, AchievementProgress> = {};
  for (const a of ACHIEVEMENTS) {
    map[a.id] = {
      ...(a.target !== undefined ? { progress: a.progress ?? 0 } : {}),
      ...(a.target === undefined ? { completed: a.completed === true } : {}),
    };
  }
  return map;
}

function parseProgress(raw: string | null): Record<string, AchievementProgress> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, AchievementProgress>;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadAchievementProgress(userKey: string): Record<string, AchievementProgress> {
  if (!userKey) return createDefaultAchievementProgress();
  const stored = parseProgress(readKey(achievementsStorageKey(userKey)));
  if (stored) {
    const defaults = createDefaultAchievementProgress();
    return { ...defaults, ...stored };
  }
  const seeded = createDefaultAchievementProgress();
  saveAchievementProgress(userKey, seeded);
  return seeded;
}

export function saveAchievementProgress(
  userKey: string,
  progress: Record<string, AchievementProgress>,
) {
  if (!userKey) return;
  writeKey(achievementsStorageKey(userKey), JSON.stringify(progress));
}

/** Merge catalogue definitions with a user's saved progress. */
export function resolveAchievements(
  progress: Record<string, AchievementProgress>,
): Achievement[] {
  return ACHIEVEMENTS.map((base) => {
    const saved = progress[base.id];
    if (!saved) return { ...base };

    if (base.target !== undefined) {
      const current = Number.isFinite(saved.progress) ? Number(saved.progress) : 0;
      return {
        ...base,
        progress: Math.max(0, Math.min(base.target, current)),
        completed: undefined,
      };
    }

    return {
      ...base,
      progress: undefined,
      completed: saved.completed === true,
    };
  });
}

export function sortAchievements(list: Achievement[]): Achievement[] {
  const rank = (a: Achievement): number => {
    const done =
      a.target !== undefined
        ? (a.progress ?? 0) >= a.target
        : a.completed === true;
    if (done) return 0;
    if ((a.progress ?? 0) > 0) return 1;
    return 2;
  };

  return [...list].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return a.title.localeCompare(b.title, 'ru');
  });
}
