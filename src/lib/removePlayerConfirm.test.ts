import { describe, expect, it } from 'vitest';
import { removeTournamentPlayerConfirm } from './removePlayerConfirm';

describe('remove tournament player confirmation', () => {
  it('names the player and the tournament', () => {
    expect(removeTournamentPlayerConfirm(' Atlas ', 'FREEROLL')).toBe(
      'Удалить Atlas из турнира «FREEROLL»?\n\nИгрок пропадёт из списка. Удаление выполнится только после подтверждения.',
    );
  });

  it('still asks when the nickname or title is blank', () => {
    expect(removeTournamentPlayerConfirm('  ', '')).toContain('этого игрока');
    expect(removeTournamentPlayerConfirm('  ', '')).toContain('этот турнир');
  });
});
