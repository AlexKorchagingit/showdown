import { describe, expect, it } from 'vitest';
import { calculatePayouts } from '../data/prizeStructure';
import type { Participant, Tournament } from '../types/tournament';
import {
  assignRandomTeamPairs,
  displayedTeamPlace,
  findTeamPartner,
  isTeamBattleEvent,
  rebindTeamPartnerIdentity,
  removeSeatKeepingTeams,
  setTeamPartner,
  splitTeamPlacePoints,
  teamBattleFinalTableSize,
  teamPrizeAtPlace,
  teamRatingPointsForPlayer,
  teamScoringPlace,
} from './teamBattle';

function player(id: string, patch: Partial<Participant> = {}): Participant {
  return { id, nickname: id, rating: 0, arrived: true, ...patch };
}

function event(participants: Participant[], title = 'TEAM BATTLE 21.09'): Tournament {
  return {
    id: 't-team',
    title,
    imageUrl: '',
    address: '',
    startDate: '2026-09-21',
    startTime: '19:00',
    totalSeats: 27,
    guarantee: 12_000,
    about: '',
    features: [],
    lateRegUntil: '',
    blindStructure: '',
    stackSize: 30_000,
    levelDuration: '20 мин',
    isClosed: false,
    participants,
  };
}

describe('TEAM BATTLE pairing', () => {
  it('detects the format from the title', () => {
    expect(isTeamBattleEvent(event([]))).toBe(true);
    expect(isTeamBattleEvent(event([], 'BOUNTY HUNTER'))).toBe(false);
    expect(isTeamBattleEvent(event([], 'Friday team battle turbo'))).toBe(true);
  });

  it('builds unique mutual pairs and leaves the odd cashier seat solo', () => {
    const paired = assignRandomTeamPairs(
      [
        player('a'),
        player('b'),
        player('c'),
        player('ghost', { arrived: false }),
        player('d'),
        player('e'),
      ],
      't-team',
      () => 0,
    );
    const arrived = paired.filter((row) => row.arrived === true);
    const linked = arrived.filter((row) => row.teamPartnerId);
    expect(linked).toHaveLength(4);
    expect(arrived.filter((row) => !row.teamPartnerId)).toHaveLength(1);
    expect(paired.find((row) => row.id === 'ghost')?.teamPartnerId).toBeUndefined();
    for (const row of linked) {
      const partner = findTeamPartner(paired, row, 't-team');
      expect(partner?.teamPartnerId).toBe(row.id);
    }
  });

  it('reassigns a pair by tap and frees the previous partners', () => {
    const start = setTeamPartner(
      setTeamPartner([player('a'), player('b'), player('c'), player('d')], 'a', 'b'),
      'c',
      'd',
    );
    const next = setTeamPartner(start, 'a', 'c');
    expect(findTeamPartner(next, next[0]!, '')?.id).toBe('c');
    expect(findTeamPartner(next, next[2]!, '')?.id).toBe('a');
    expect(next.find((row) => row.id === 'b')?.teamPartnerId).toBeUndefined();
    expect(next.find((row) => row.id === 'd')?.teamPartnerId).toBeUndefined();
  });

  it('unpairs when a seat leaves the cashier field', () => {
    const start = setTeamPartner([player('a'), player('b'), player('c')], 'a', 'b');
    const next = removeSeatKeepingTeams(start, 'a');
    expect(next.map((row) => row.id)).toEqual(['b', 'c']);
    expect(next[0]?.teamPartnerId).toBeUndefined();
  });

  it('rewrites partner ids when a guest is bound to a club account', () => {
    const start = setTeamPartner(
      [player('guest-ivan', { userId: null }), player('user-2')],
      'guest-ivan',
      'user-2',
    );
    const rebound = start.map((row) =>
      row.id === 'guest-ivan' ? { ...row, id: 'user-1', userId: 'user-1', nickname: 'Ivan' } : row,
    );
    const next = rebindTeamPartnerIdentity(rebound, 'guest-ivan', 'user-1');
    expect(next.find((row) => row.id === 'user-2')?.teamPartnerId).toBe('user-1');
    expect(findTeamPartner(next, next.find((row) => row.id === 'user-1')!, '')?.id).toBe('user-2');
  });
});

describe('TEAM BATTLE scoring', () => {
  it('uses the better individual place and splits points, remainder to the better seat', () => {
    const participants = [
      player('a', { place: 1, teamPartnerId: 'b' }),
      player('b', { place: 4, teamPartnerId: 'a' }),
      player('c', { place: 2 }),
      player('d', { place: 3 }),
    ];
    const tournament = event(participants);
    // 4 players, ITM = 2, 1st = 7800 of 12000, 2nd = 4200.
    expect(teamScoringPlace(participants[0]!, participants)).toBe(1);
    expect(teamScoringPlace(participants[1]!, participants)).toBe(1);
    expect(teamRatingPointsForPlayer(participants[0]!, tournament, 4)).toBe(3900);
    expect(teamRatingPointsForPlayer(participants[1]!, tournament, 4)).toBe(3900);
    expect(displayedTeamPlace(participants[0]!, tournament)).toBe(1);
    expect(displayedTeamPlace(participants[1]!, tournament)).toBe(1);
  });

  it('ranks finished teams consecutively so worse teammate places do not leave holes', () => {
    const participants = [
      player('a', { place: 1, teamPartnerId: 'b' }),
      player('b', { place: 4, teamPartnerId: 'a' }),
      player('c', { place: 2, teamPartnerId: 'd' }),
      player('d', { place: 5, teamPartnerId: 'c' }),
      player('e', { place: 3, teamPartnerId: 'f' }),
      player('f', { place: 8, teamPartnerId: 'e' }),
      player('g', { place: 6, teamPartnerId: 'h' }),
      player('h', { place: 10, teamPartnerId: 'g' }),
      player('i', { place: 7, teamPartnerId: 'j' }),
      player('j', { place: 11, teamPartnerId: 'i' }),
      player('k', { place: 9, teamPartnerId: 'l' }),
      player('l', { place: 12, teamPartnerId: 'k' }),
    ];
    const tournament = event(participants);
    expect(teamScoringPlace(participants[0]!, participants)).toBe(1);
    expect(teamScoringPlace(participants[2]!, participants)).toBe(2);
    expect(teamScoringPlace(participants[4]!, participants)).toBe(3);
    expect(teamScoringPlace(participants[6]!, participants)).toBe(4);
    expect(teamScoringPlace(participants[8]!, participants)).toBe(5);
    expect(teamScoringPlace(participants[10]!, participants)).toBe(6);
    // 12 players, ITM = 5. Fourth team gets 4th-place points, not 6th.
    const fourth = calculatePayouts(12, 12_000)[3]!;
    expect(teamPrizeAtPlace(tournament, 4, 12)?.names).toEqual(['g', 'h']);
    expect(teamPrizeAtPlace(tournament, 4, 12)?.pointsEach).toBe(Math.floor(fourth.points / 2));
    expect(teamPrizeAtPlace(tournament, 6, 12)?.names).toEqual(['k', 'l']);
    expect(teamPrizeAtPlace(tournament, 8, 12)).toBeUndefined();
    expect(teamRatingPointsForPlayer(participants[6]!, tournament, 12)).toBe(Math.floor(fourth.points / 2));
  });

  it('fills consecutive timer rows for the 23-player ITM table instead of teammate holes', () => {
    const pairs: [string, string, number, number][] = [
      ['Энвилоуп', 'Freedom', 1, 4],
      ['HEYDAS', 'Rinswind', 2, 5],
      ['KEVIN', 'Useless', 3, 8],
      ['Dayya', 'DISCUS', 6, 10],
      ['Denven032', 'MariaSubbota', 7, 11],
      ['Владимир 32', 'Evgenchip', 9, 12],
      ['t7a', 't7b', 13, 14],
      ['t8a', 't8b', 15, 16],
      ['t9a', 't9b', 17, 18],
      ['t10a', 't10b', 19, 20],
      ['t11a', 't11b', 21, 22],
    ];
    const participants = [
      ...pairs.flatMap(([left, right, leftPlace, rightPlace]) => [
        player(left, { place: leftPlace, teamPartnerId: right, nickname: left }),
        player(right, { place: rightPlace, teamPartnerId: left, nickname: right }),
      ]),
      player('solo', { place: 23, nickname: 'solo' }),
    ];
    const tournament = event(participants);
    const payouts = calculatePayouts(23, 12_000);
    expect(payouts).toHaveLength(9);
    expect(teamPrizeAtPlace(tournament, 1, 23)?.names).toEqual(['Freedom', 'Энвилоуп']);
    expect(teamPrizeAtPlace(tournament, 1, 23)?.pointsEach).toBe(Math.floor(payouts[0]!.points / 2));
    expect(teamPrizeAtPlace(tournament, 4, 23)?.names).toEqual(['DISCUS', 'Dayya']);
    expect(teamPrizeAtPlace(tournament, 4, 23)?.pointsEach).toBe(Math.floor(payouts[3]!.points / 2));
    expect(teamPrizeAtPlace(tournament, 8, 23)?.names).toEqual(['t8a', 't8b']);
    expect(teamPrizeAtPlace(tournament, 9, 23)?.names).toEqual(['t9a', 't9b']);
    expect(payouts[0]!.points).toBe(3375);
    expect(teamPrizeAtPlace(tournament, 1, 23)?.pointsEach).toBe(1687);
  });

  it('shifts finished teams down while other teams are still alive', () => {
    const participants = [
      player('alive-a', { teamPartnerId: 'alive-b' }),
      player('alive-b', { teamPartnerId: 'alive-a' }),
      player('out-a', { place: 6, teamPartnerId: 'out-b' }),
      player('out-b', { place: 7, teamPartnerId: 'out-a' }),
    ];
    expect(teamScoringPlace(participants[2]!, participants)).toBe(2);
    expect(teamScoringPlace(participants[0]!, participants)).toBeUndefined();
  });

  it('keeps a team alive while the partner is still playing', () => {
    const participants = [player('a', { place: 8, teamPartnerId: 'b' }), player('b', { teamPartnerId: 'a' })];
    expect(teamScoringPlace(participants[0]!, participants)).toBeUndefined();
    expect(teamPrizeAtPlace(event(participants), 8, 23)).toBeUndefined();
  });

  it('gives a solo player the full place award', () => {
    expect(splitTeamPlacePoints(3481, 1, undefined)).toBe(3481);
    expect(splitTeamPlacePoints(3481, 1, 2)).toBe(1741);
    expect(splitTeamPlacePoints(3481, 2, 1)).toBe(1740);
  });

  it('labels the timer prize row with both nicks and the per-person share', () => {
    const participants = [
      player('Алиса', { place: 1, teamPartnerId: 'Борис', nickname: 'Алиса' }),
      player('Борис', { place: 2, teamPartnerId: 'Алиса', nickname: 'Борис' }),
    ];
    const tournament = { ...event(participants), guarantee: 12_000 };
    const first = calculatePayouts(2, 12_000)[0]!;
    const row = teamPrizeAtPlace(tournament, 1, 2);
    expect(row?.names).toEqual(['Алиса', 'Борис']);
    expect(row?.pointsEach).toBe(Math.floor(first.points / 2));
  });

  it('sizes the final table as ITM places + 1', () => {
    expect(teamBattleFinalTableSize(23)).toBe(10);
    expect(teamBattleFinalTableSize(22)).toBe(9);
    expect(teamBattleFinalTableSize(0)).toBe(0);
  });
});
