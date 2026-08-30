import { describe, expect, it } from 'vitest';
import { formatTournamentHeldOn } from './timerTournament';

describe('formatTournamentHeldOn', () => {
  it('prints the calendar day and start time without a timezone shift', () => {
    const label = formatTournamentHeldOn('2026-08-30', '19:00');
    expect(label).toContain('30');
    expect(label.toLowerCase()).toContain('август');
    expect(label).toContain('19:00');
  });

  it('falls back to a dash when both date and time are empty', () => {
    expect(formatTournamentHeldOn('', '')).toBe('—');
  });
});
