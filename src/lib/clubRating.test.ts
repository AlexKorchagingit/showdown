import { describe, expect, it } from 'vitest';
import { clubRatingPlayers, lobbySeatedPlayers } from './clubRating';
import { collectPlayerGameHistory } from './playerAnalytics';
import type { MappedUser } from './supabaseMap';
import type { Participant, Tournament } from '../types/tournament';

function guestUser(id: string, nickname: string): MappedUser {
  return {
    id,
    email: '',
    nickname,
    isAdmin: false,
    rubyBalance: 0,
    coins: 0,
    birthDate: '',
    slogan: '',
    ownedItems: [],
    equippedChar: 'char_base',
    equippedBg: 'bg_base',
    equippedAvatar: '',
    pendingNotifications: [],
  };
}

function closedEvent(participants: Participant[]): Tournament {
  return {
    id: 'opening',
    title: 'Opening',
    imageUrl: '',
    address: '',
    startDate: '2026-08-01',
    startTime: '19:00',
    totalSeats: 27,
    guarantee: 10_000,
    about: '',
    features: [],
    participants,
    lateRegUntil: '',
    blindStructure: '',
    stackSize: 30_000,
    levelDuration: '',
    isClosed: true,
  };
}

describe('guest seats in rating and lobby', () => {
  const club = guestUser('user-1', 'Club');
  club.email = 'club@test.ru';
  const tournament = closedEvent([
    { id: 'user-1', userId: 'user-1', nickname: 'Club', rating: 0, place: 1 },
    { id: 'opening:guest-ivan', userId: null, nickname: 'Иван', rating: 0, place: 2 },
    { id: 'user-2', userId: 'user-2', nickname: 'Other', rating: 0, place: 3 },
  ]);

  it('counts guest history after a prefixed PK', () => {
    const rows = collectPlayerGameHistory([tournament], ['guest-ivan']);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.place).toBe(2);
    expect(rows[0]?.ratingAwarded).toBeGreaterThan(0);
  });

  it('lists nick-only players in the club rating', () => {
    const ranked = clubRatingPlayers([club], [tournament]);
    expect(ranked.map((row) => row.id)).toEqual(['user-1', 'guest-ivan']);
    expect(ranked[1]?.nickname).toBe('Иван');
    expect(ranked[1]?.played).toBe(1);
  });

  it('shows guest seats in the closed lobby list', () => {
    const seated = lobbySeatedPlayers(tournament.participants, new Set(['user-1']));
    expect(seated.map((row) => row.nickname)).toEqual(['Club', 'Иван']);
  });
});
