import {
  ACHIEVEMENTS,
  type Achievement,
  type AchievementProgress,
} from '../data/achievements';
import { safeLocalStorage } from './safeStorage';

const PROGRESS_PREFIX = 'achievements_';
const EPOCH_KEY = 'showdown.achievementEpoch';
/** Bump to wipe every device's stored progress once after a deploy. */
export const ACHIEVEMENT_EPOCH = 1;

function normalizeKey(userKey: string): string {
  return userKey.trim().toLowerCase();
}

export function achievementsStorageKey(userKey: string): string {
  return `${PROGRESS_PREFIX}${normalizeKey(userKey)}`;
}

function readKey(key: string): string | null {
  return safeLocalStorage.getItem(key);
}

function writeKey(key: string, value: string) {
  safeLocalStorage.setItem(key, value);
}

/** One-time wipe of every `achievements_*` row on this device. */
export function applyAchievementEpochReset(): void {
  const current = Number(safeLocalStorage.getItem(EPOCH_KEY) ?? '0');
  if (Number.isFinite(current) && current >= ACHIEVEMENT_EPOCH) return;

  safeLocalStorage.keys()
    .filter((key) => key.startsWith(PROGRESS_PREFIX))
    .forEach((key) => safeLocalStorage.removeItem(key));
  safeLocalStorage.setItem(EPOCH_KEY, String(ACHIEVEMENT_EPOCH));
}

/** Empty progress for a new player — nothing pre-unlocked. */
export function createDefaultAchievementProgress(): Record<string, AchievementProgress> {
  const map: Record<string, AchievementProgress> = {};
  for (const a of ACHIEVEMENTS) {
    map[a.id] =
      a.target !== undefined ? { progress: 0 } : { completed: false };
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
  applyAchievementEpochReset();
  const empty = createDefaultAchievementProgress();
  if (!userKey) return empty;
  const stored = parseProgress(readKey(achievementsStorageKey(userKey)));
  if (!stored) return empty;
  return { ...empty, ...stored };
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

    if (base.target !== undefined) {
      const current = Number(saved?.progress);
      const progress = Number.isFinite(current) ? current : 0;
      return {
        ...base,
        progress: Math.max(0, Math.min(base.target, progress)),
        completed: undefined,
      };
    }

    return {
      ...base,
      progress: undefined,
      completed: saved?.completed === true,
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
