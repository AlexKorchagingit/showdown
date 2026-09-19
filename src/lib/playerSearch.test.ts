import { describe, expect, it } from 'vitest';
import { matchesPlayerSearch } from './playerSearch';

describe('matchesPlayerSearch', () => {
  const discus = { nickname: 'DISCUS', email: 'discus@club.test' };

  it('matches a partial nickname without caring about case', () => {
    expect(matchesPlayerSearch(discus, 'dis')).toBe(true);
    expect(matchesPlayerSearch(discus, 'CUS')).toBe(true);
  });

  it('matches email when the nickname does not', () => {
    expect(matchesPlayerSearch(discus, 'club.test')).toBe(true);
    expect(matchesPlayerSearch(discus, 'zzz')).toBe(false);
  });

  it('treats blank input as "show everyone"', () => {
    expect(matchesPlayerSearch(discus, '   ')).toBe(true);
  });
});
