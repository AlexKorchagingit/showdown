import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { rpc: mocks.rpc }, logSupabaseError: vi.fn() }));

import {
  AchievementsUnavailableError,
  fetchAchievementProgress,
  normalizeAchievementProgress,
  saveAchievementProgress,
} from './achievementsApi';

beforeEach(() => vi.clearAllMocks());

describe('club achievement grants', () => {
  it('keeps only catalogue fields from a stored row', () => {
    expect(normalizeAchievementProgress({
      welcome: { completed: true, note: 'ignored' },
      fish: { progress: '4.7' },
      broken: { progress: 'many' },
      wrong: 'nope',
    })).toEqual({ welcome: { completed: true }, fish: { progress: 4 } });
  });

  it('reads a player progress map by account id', async () => {
    mocks.rpc.mockResolvedValue({ data: { welcome: { completed: true } }, error: null });

    await expect(fetchAchievementProgress('player-1')).resolves.toEqual({ welcome: { completed: true } });
    expect(mocks.rpc).toHaveBeenCalledWith('club_achievements_snapshot', { p_user_id: 'player-1' });
  });

  it('treats a player without grants as an empty catalogue, not an error', async () => {
    mocks.rpc.mockResolvedValue({ data: {}, error: null });

    await expect(fetchAchievementProgress('player-1')).resolves.toEqual({});
  });

  it('names the missing migration instead of a generic failure', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.club_achievements_snapshot' },
    });

    await expect(fetchAchievementProgress('player-1')).rejects.toBeInstanceOf(AchievementsUnavailableError);
  });

  it('sends the whole grant list and returns what the server confirmed', async () => {
    mocks.rpc.mockResolvedValue({
      data: { user_id: 'player-1', progress: { fish: { progress: 3 } } },
      error: null,
    });

    await expect(saveAchievementProgress('player-1', { fish: { progress: 3 } }))
      .resolves.toEqual({ fish: { progress: 3 } });
    expect(mocks.rpc).toHaveBeenCalledWith('club_save_achievements', {
      p_user_id: 'player-1',
      p_progress: { fish: { progress: 3 } },
    });
  });

  it('does not report success when the server answered about another player', async () => {
    mocks.rpc.mockResolvedValue({ data: { user_id: 'player-2', progress: {} }, error: null });

    await expect(saveAchievementProgress('player-1', {})).rejects.toThrow('не подтвердил');
  });
});
