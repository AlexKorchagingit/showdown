import { describe, expect, it } from 'vitest';
import type { Participant, Tournament } from '../types/tournament';
import { eventRatingAward, isSquadScoreEvent, squadAwards, squadBoardActive, squadTeamPlace, squadTeamsByPoints, SQUAD_EVENT_ID } from './squadScores';

function player(id: string, squadNo?: number, squadPoints?: number): Participant {
  return { id, nickname: id, rating: 0, squadNo, squadPoints };
}

describe('13 Oct squad scoreboard', () => {
  it('gives every player the place of their team', () => {
    const players = [
      player('freedom', 2, 100),
      player('mate', 2, 180),
      ...[1, 2, 3, 4, 5].map((index) => player(`win-${index}`, 5, 57)),
    ];
    expect(squadTeamPlace(players[0]!, players)).toBe(2);
    expect(squadTeamPlace(players[2]!, players)).toBe(1);
  });

  it('lists teams from the highest total points', () => {
    expect(squadTeamsByPoints([0, 240, 280, 255, 250, 285, 270])).toEqual([5, 2, 6, 3, 4, 1]);
    expect(squadTeamsByPoints([0, 10, 10, 0, 0, 0, 0])).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('recognises only that one tournament', () => {
    expect(isSquadScoreEvent({ id: SQUAD_EVENT_ID })).toBe(true);
    expect(isSquadScoreEvent({ id: 't-other' })).toBe(false);
    expect(squadBoardActive([player('a')])).toBe(false);
    expect(squadBoardActive([player('a', 2, 10)])).toBe(true);
  });

  it('splits the guarantee by team points and gives teammates the same rating', () => {
    const players = [
      player('a1', 1, 30),
      player('a2', 1, 10),
      player('b1', 2, 60),
    ];
    const awards = squadAwards(players, 100);
    expect(awards.teamPoints[1]).toBe(40);
    expect(awards.teamPoints[2]).toBe(60);
    expect(awards.awardById.get('a1')).toBe(28);
    expect(awards.awardById.get('a2')).toBe(28);
    expect(awards.awardById.get('b1')).toBe(42);
    expect(awards.awardById.get('b1')).toBeGreaterThan(awards.awardById.get('a1') ?? 0);
  });

  it('drops a remainder inside a team so nobody gets a different share', () => {
    const players = [player('a', 1, 1), player('b', 1, 1), player('c', 1, 1)];
    const awards = squadAwards(players, 10);
    expect(awards.awardById.get('a')).toBe(3);
    expect(awards.awardById.get('b')).toBe(3);
    expect(awards.awardById.get('c')).toBe(3);
  });

  it('gives a larger team pool to the team with more points', () => {
    const players = [1, 2, 3, 4, 5, 6].map((team) => player(`p${team}`, team, team));
    const awards = squadAwards(players, 25000);
    const shares = [1, 2, 3, 4, 5, 6].map((team) => awards.awardById.get(`p${team}`) ?? 0);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(25000);
    for (let index = 1; index < shares.length; index += 1) {
      expect(shares[index]).toBeGreaterThan(shares[index - 1] ?? 0);
    }
  });

  it('pays the leading team more per person even when that team is larger', () => {
    const players = [
      ...[1, 2, 3].map((index) => player(`small-${index}`, 3, 85)),
      ...[1, 2, 3, 4, 5].map((index) => player(`win-${index}`, 5, 57)),
    ];
    const awards = squadAwards(players, 25000);
    expect(awards.teamPoints[3]).toBe(255);
    expect(awards.teamPoints[5]).toBe(285);
    const winner = awards.awardById.get('win-1') ?? 0;
    const smaller = awards.awardById.get('small-1') ?? 0;
    expect(winner).toBeGreaterThan(smaller);
    expect(awards.awardById.get('win-5')).toBe(winner);
  });

  it('leaves ordinary place prizes until someone is assigned to a team', () => {
    const lone = player('solo');
    lone.place = 1;
    const tournament = {
      id: SQUAD_EVENT_ID,
      title: 'FREEROLL TEAM BATTLE',
      blindStructure: '',
      guarantee: 1000,
      participants: [lone],
      isBounty: false,
    } as Tournament;
    expect(eventRatingAward(lone, tournament, 1)).toBeGreaterThan(0);

    const teamed = { ...lone, squadNo: 1, squadPoints: 5 };
    const live = { ...tournament, participants: [teamed] };
    expect(eventRatingAward(teamed, live, 1)).toBe(1000);
  });

  it('keeps the saved award when team numbers are not on this screen', () => {
    const seated = player('solo');
    seated.place = 1;
    seated.rating = 949;
    const tournament = {
      id: SQUAD_EVENT_ID,
      title: 'FREEROLL TEAM BATTLE',
      blindStructure: '',
      guarantee: 25000,
      participants: [seated],
      isBounty: false,
      isClosed: true,
    } as Tournament;
    expect(eventRatingAward(seated, tournament, 24)).toBe(949);
  });

  it('changes the awarded rating when one player’s points change', () => {
    const before = [
      player('a', 1, 40),
      player('b', 1, 50),
      player('c', 2, 100),
    ];
    const after = [
      player('a', 1, 90),
      player('b', 1, 50),
      player('c', 2, 100),
    ];
    const first = squadAwards(before, 25000).awardById.get('a');
    const next = squadAwards(after, 25000).awardById.get('a');
    expect(first).not.toBe(next);
    expect(squadAwards(after, 25000).awardById.get('a')).toBe(squadAwards(after, 25000).awardById.get('b'));
  });
});
