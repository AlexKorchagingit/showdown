import { supabase, logSupabaseError } from './supabase';
import { withRequestDeadline } from './network';
import type { AchievementProgress } from '../data/achievements';

export type AchievementProgressMap = Record<string, AchievementProgress>;

/** PostgREST answers with these when the migration has not been applied yet. */
const MISSING_API_CODES = new Set(['PGRST202', '404', '42883']);

export class AchievementsUnavailableError extends Error {
  constructor() {
    super('Хранилище достижений не создано в базе. Примените миграцию 20260913_achievements.sql.');
  }
}

function isMissingApi(error: { code?: string | null; message?: string | null }): boolean {
  if (MISSING_API_CODES.has(String(error.code ?? ''))) return true;
  const message = (error.message ?? '').toLowerCase();
  return message.includes('club_achievements_snapshot') || message.includes('club_save_achievements');
}

/** Keep only the two catalogue fields, so a stale row cannot break the screen. */
export function normalizeAchievementProgress(raw: unknown): AchievementProgressMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: AchievementProgressMap = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const entry = value as { progress?: unknown; completed?: unknown };
    const saved: AchievementProgress = {};
    const progress = Number(entry.progress);
    if (Number.isFinite(progress)) saved.progress = Math.max(0, Math.trunc(progress));
    if (typeof entry.completed === 'boolean') saved.completed = entry.completed;
    if (saved.progress !== undefined || saved.completed !== undefined) result[id] = saved;
  }
  return result;
}

export async function fetchAchievementProgress(userId: string): Promise<AchievementProgressMap> {
  if (!userId.trim()) return {};
  const { data, error } = await withRequestDeadline(
    supabase.rpc('club_achievements_snapshot', { p_user_id: userId }),
    15_000,
  );
  if (error) {
    logSupabaseError(error, 'achievements');
    if (isMissingApi(error)) throw new AchievementsUnavailableError();
    throw new Error('Не удалось загрузить достижения. Проверьте связь и повторите.');
  }
  return normalizeAchievementProgress(data);
}

export async function saveAchievementProgress(
  userId: string,
  progress: AchievementProgressMap,
): Promise<AchievementProgressMap> {
  const { data, error } = await withRequestDeadline(
    supabase.rpc('club_save_achievements', { p_user_id: userId, p_progress: progress }),
    15_000,
  );
  if (error) {
    logSupabaseError(error, 'save achievements');
    if (isMissingApi(error)) throw new AchievementsUnavailableError();
    throw new Error(error.message || 'Не удалось сохранить достижения');
  }
  const confirmed = data as { user_id?: unknown; progress?: unknown } | null;
  if (!confirmed || confirmed.user_id !== userId) {
    throw new Error('Сервер не подтвердил сохранение достижений');
  }
  return normalizeAchievementProgress(confirmed.progress);
}
