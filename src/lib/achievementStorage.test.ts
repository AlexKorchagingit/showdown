import { describe, expect, it } from 'vitest';
import {
  hasAchievementGrants,
  mergeAchievementProgress,
  resolveAchievements,
} from './achievementStorage';

describe('achievementStorage helpers', () => {
  it('treats only actual grants as legacy drafts worth uploading', () => {
    expect(hasAchievementGrants({ welcome: { completed: false }, fish: { progress: 0 } })).toBe(false);
    expect(hasAchievementGrants({ welcome: { completed: true } })).toBe(true);
    expect(hasAchievementGrants({ fish: { progress: 3 } })).toBe(true);
  });

  it('fills catalogue defaults so a sparse server row still renders every badge', () => {
    const merged = mergeAchievementProgress({ winner: { completed: true } });
    expect(merged.winner).toEqual({ completed: true });
    expect(merged.welcome).toEqual({ completed: false });
    expect(merged.fish).toEqual({ progress: 0 });
    expect(resolveAchievements(merged).find((row) => row.id === 'winner')?.completed).toBe(true);
    const karen = resolveAchievements(merged).find((row) => row.id === 'knock-karen');
    expect(karen?.title).toBe('Выбить Карена');
    expect(karen?.target).toBeUndefined();
    expect(karen?.completed).toBe(false);
    expect(karen?.imageUrl).toBe('');
  });
});
