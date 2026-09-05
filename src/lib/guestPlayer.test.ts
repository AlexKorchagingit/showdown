import { describe, expect, it } from 'vitest';
import {
  guestParticipantId,
  guestSeatKey,
  isGuestParticipantId,
  isUnboundGuestSeat,
  normalizeGuestNickname,
  slugGuestNickname,
} from './guestPlayer';
import { participantFromRow } from './supabaseMap';

describe('guest player ids', () => {
  it('slugs nicknames and keeps cyrillic', () => {
    expect(slugGuestNickname('  Иван Ёж  ')).toBe('иван-еж');
    expect(slugGuestNickname('???')).toBe('player');
  });

  it('allocates a unique guest- id within a tournament', () => {
    expect(guestParticipantId('Иван', [])).toBe('guest-иван');
    expect(guestParticipantId('Иван', ['guest-иван'])).toBe('guest-иван-2');
    expect(guestParticipantId('Иван', ['opening:guest-иван'])).toBe('guest-иван-2');
  });

  it('detects guest seats even when the PK still has a tournament prefix', () => {
    expect(isGuestParticipantId('opening:guest-ivan')).toBe(true);
    expect(isUnboundGuestSeat({ id: 'opening:guest-ivan', userId: null })).toBe(true);
    expect(isUnboundGuestSeat({ id: 'guest-ivan', userId: 'user-1' })).toBe(false);
    expect(isUnboundGuestSeat({ id: 'user-1', userId: 'user-1' })).toBe(false);
  });

  it('rejects too-short or too-long nicks', () => {
    expect(normalizeGuestNickname('  A  ')).toBeNull();
    expect(normalizeGuestNickname('Ab')).toBe('Ab');
    expect(normalizeGuestNickname('12345678901234567')).toBe('12345678901234567');
    expect(normalizeGuestNickname('123456789012345678')).toBeNull();
  });
});

describe('participantFromRow guest seats', () => {
  it('unwraps a null user_id PK so rating can match the guest id', () => {
    const player = participantFromRow({
      id: 'opening:guest-ivan',
      tournament_id: 'opening',
      user_id: null,
      nickname: 'Ivan',
      rating: 0,
      place: 4,
      knockouts: 0,
      rubies_awarded: null,
      comment: null,
    });
    expect(player.id).toBe('guest-ivan');
    expect(player.userId).toBeNull();
    expect(player.arrived).toBe(false);
    expect(guestSeatKey(player.id)).toBe('guest-ivan');
  });

  it('keeps bound seats on the real users.id', () => {
    const player = participantFromRow({
      id: 'opening:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      tournament_id: 'opening',
      user_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      nickname: 'Club',
      rating: 10,
      place: 1,
      knockouts: 0,
      rubies_awarded: 100,
      comment: null,
    });
    expect(player.id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(player.userId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });
});
