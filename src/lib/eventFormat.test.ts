import { describe, expect, it } from 'vitest';
import { eventFormatOf, isFreerollEvent } from './eventFormat';

describe('event format', () => {
  it('keeps an explicit choice even when the title says something else', () => {
    expect(eventFormatOf({ title: 'FREEROLL TEAM BATTLE', eventFormat: 'regular' })).toBe('regular');
    expect(eventFormatOf({ title: 'FRIDAY', eventFormat: 'team' })).toBe('team');
    expect(isFreerollEvent({ title: 'DEEPSTACK', eventFormat: 'freeroll' })).toBe(true);
  });

  it('reads older nights from the title and the bounty flag', () => {
    expect(eventFormatOf({ title: 'FREEROLL TEAM BATTLE' })).toBe('team');
    expect(eventFormatOf({ title: 'FREEROLL' })).toBe('freeroll');
    expect(eventFormatOf({ title: 'CHILL OUT', isBounty: true })).toBe('knockout');
    expect(eventFormatOf({ title: 'BOUNTY HUNTER' })).toBe('knockout');
    expect(eventFormatOf({ title: 'DEEPSTACK' })).toBe('regular');
  });
});
