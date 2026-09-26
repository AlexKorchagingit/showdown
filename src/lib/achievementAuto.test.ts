import { describe, expect, it } from 'vitest';
import { computeAutoAchievementProgress, mergeAutoAndSavedProgress } from './achievementAuto';
import type { MappedUser } from './supabaseMap';
import type { Participant, Tournament } from '../types/tournament';

function user(id: string, nickname = id): MappedUser {
  return {
    id,
    email: `${id}@test.ru`,
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

function player(id: string, place: number, knockouts = 0): Participant {
  return { id, userId: id, nickname: id, rating: 0, place, knockouts, arrived: true };
}

function closedEvent(
  id: string,
  startDate: string,
  participants: Participant[],
  title = 'Friday',
): Tournament {
  return {
    id,
    title,
    imageUrl: '',
    address: '',
    startDate,
    startTime: '19:00',
    totalSeats: 27,
    guarantee: 12_000,
    about: '',
    features: [],
    participants,
    lateRegUntil: '',
    blindStructure: '',
    stackSize: 30_000,
    levelDuration: '20 мин',
    isClosed: true,
  };
}

function field(size: number, hero: { id: string; place: number; knockouts?: number }): Participant[] {
  const rows: Participant[] = [];
  for (let place = 1; place <= size; place += 1) {
    const id = place === hero.place ? hero.id : `p${place}`;
    rows.push(player(id, place, id === hero.id ? (hero.knockouts ?? 0) : 0));
  }
  return rows;
}

describe('computeAutoAchievementProgress', () => {
  const hero = user('hero');
  const rival = user('rival');

  it('counts visits, welcome, winner, paparazzi, finalist and bubble', () => {
    const twentyThree = closedEvent('a', '2026-09-01', field(23, { id: 'hero', place: 1 }));
    const twentyTwoBubble = closedEvent('b', '2026-09-08', field(22, { id: 'hero', place: 9 }));
    const auto = computeAutoAchievementProgress('hero', [twentyThree, twentyTwoBubble], [hero]);
    expect(auto.welcome?.completed).toBe(true);
    expect(auto.winner?.completed).toBe(true);
    expect(auto.paparazzi?.completed).toBe(true);
    expect(auto.finalist?.completed).toBe(true);
    expect(auto.bubble?.completed).toBe(true);
    expect(auto.fish?.progress).toBe(2);
  });

  it('does not treat a 23-player ninth place as the bubble', () => {
    const event = closedEvent('c', '2026-09-01', field(23, { id: 'hero', place: 9 }));
    const auto = computeAutoAchievementProgress('hero', [event], [hero]);
    expect(auto.finalist?.completed).toBe(true);
    expect(auto.bubble?.completed).toBe(false);
    expect(auto.paparazzi?.completed).toBe(false);
  });

  it('grants paparazzi for any top-3 finish', () => {
    const event = closedEvent('d', '2026-09-01', field(22, { id: 'hero', place: 3 }));
    const auto = computeAutoAchievementProgress('hero', [event], [hero]);
    expect(auto.paparazzi?.completed).toBe(true);
    expect(auto.winner?.completed).toBe(false);
  });

  it('tracks headhunter from the best single tournament', () => {
    const event = closedEvent('e', '2026-09-01', field(22, { id: 'hero', place: 5, knockouts: 12 }));
    const auto = computeAutoAchievementProgress('hero', [event], [hero]);
    expect(auto.headhunter?.progress).toBe(10);
  });

  it('awards monthly the-best, bounty-king, resident and predator from the same month', () => {
    const withRival = (place: number, knockouts: number, rivalPlace: number, rivalKos: number) =>
      field(22, { id: 'hero', place, knockouts }).map((row) =>
        row.place === rivalPlace ? player('rival', rivalPlace, rivalKos) : row,
      );
    const first = closedEvent('f1', '2026-08-03', withRival(1, 20, 22, 0));
    const second = closedEvent('f2', '2026-08-10', withRival(2, 5, 22, 1));
    const auto = computeAutoAchievementProgress('hero', [first, second], [hero, rival]);
    expect(auto['the-best']?.completed).toBe(true);
    expect(auto['bounty-king']?.completed).toBe(true);
    expect(auto.resident?.completed).toBe(true);
    expect(auto.predator?.progress).toBe(25);
  });
});

describe('mergeAutoAndSavedProgress', () => {
  it('keeps a larger manual grant and does not strip ruby-hand badges', () => {
    const merged = mergeAutoAndSavedProgress(
      { fish: { progress: 10 }, 'royal-flush': { completed: true }, winner: { completed: false } },
      { fish: { progress: 3 }, winner: { completed: true } },
    );
    expect(merged.fish?.progress).toBe(10);
    expect(merged.winner?.completed).toBe(true);
    expect(merged['royal-flush']?.completed).toBe(true);
  });
});
