import { describe, expect, it } from 'vitest';
import type { Tournament } from '../types/tournament';
import {
  livePrizePool,
  lobbyOverlayFigures,
  overlayGuarantee,
  overlayPreview,
  overlaySeriesKey,
  seriesAverages,
} from './overlayPlan';

function closed(id: string, title: string, arrived: number): Tournament {
  return {
    id,
    title,
    imageUrl: '',
    address: '',
    startDate: '2026-10-01',
    startTime: '19:00',
    totalSeats: 30,
    guarantee: 12000,
    about: '',
    features: [],
    participants: Array.from({ length: arrived }, (_, index) => ({
      id: `${id}-${index}`,
      nickname: `p${index}`,
      rating: 0,
      arrived: true,
    })),
    lateRegUntil: '',
    blindStructure: '',
    stackSize: 0,
    levelDuration: '',
    isClosed: true,
  };
}

describe('overlay plan', () => {
  it('keeps chill nights together and freerolls apart', () => {
    expect(overlaySeriesKey('FREEROLL CHILL OUT')).toBe('chill');
    expect(overlaySeriesKey('CHILL OUT')).toBe('chill');
    expect(overlaySeriesKey('FREEROLL')).toBe('freeroll');
    expect(overlaySeriesKey('FREEZEOUT')).toBe('freezeout');
  });

  it('adds a full share for extra people, half for a rebuy and a quarter for an addon', () => {
    expect(overlayGuarantee({
      base: 12000,
      perHead: 100,
      normPeople: 17,
      people: 41,
      rebuys: 24,
      addons: 12,
    })).toBe(15900);
    expect(overlayGuarantee({
      base: 18000,
      perHead: 100,
      normPeople: 15,
      people: 15,
      rebuys: 0,
      addons: 0,
    })).toBe(18000);
  });

  it('shows how many places and how much first place takes', () => {
    const row = overlayPreview({
      base: 12000,
      perHead: 0,
      normPeople: 17,
      people: 17,
      rebuys: 0,
      addons: 0,
    });
    expect(row.itm).toBe(6);
    expect(row.guarantee).toBe(12000);
    expect(row.first).toBe(4080);
  });

  it('averages only closed nights of the same series', () => {
    const current = { ...closed('open', 'CHILL OUT', 0), isClosed: false, participants: [] };
    const stats = seriesAverages(current, [
      current,
      closed('a', 'CHILL OUT', 10),
      closed('b', 'FREEROLL CHILL OUT', 20),
      closed('c', 'FREEZEOUT', 40),
    ], [
      { id: 'r', date: '', tournamentId: 'a', userId: 'u', type: 'rebuy', amount: 1000, status: 'paid', comment: '', isDealer: false, dealerHours: 0 },
      { id: 'd', date: '', tournamentId: 'b', userId: 'u', type: 'addon', amount: 1000, status: 'paid', comment: '', isDealer: false, dealerHours: 0 },
    ]);
    expect(stats.nights).toBe(2);
    expect(stats.people).toBe(15);
    expect(stats.rebuys).toBe(0.5);
    expect(stats.addons).toBe(0.5);
  });

  it('grows the live prize pool from the cashier field when an overlay is saved', () => {
    const night = (id: string, arrived: number) => closed(id, 'BOUNTY HUNTER', arrived);
    const open = {
      ...night('open', 31),
      isClosed: false,
      guarantee: 10000,
      overlayBase: 10000,
      overlayPerHead: 100,
      startDate: '2026-10-24',
    };
    const history = [night('a', 10), night('b', 20)];
    const rebuys = Array.from({ length: 7 }, (_, index) => ({
      id: `r${index}`,
      date: '',
      tournamentId: 'open',
      userId: 'u',
      type: 'rebuy' as const,
      amount: 1000,
      status: 'paid' as const,
      comment: '',
      isDealer: false,
      dealerHours: 0,
    }));
    expect(livePrizePool(open, [open, ...history], rebuys)).toBe(11950);
    expect(livePrizePool(
      { ...open, overlayPerHead: undefined },
      [open, ...history],
      rebuys,
    )).toBe(10000);
  });

  it('leaves a closed payout and a team battle on the stored guarantee', () => {
    const closedNight = {
      ...closed('chill', 'FREEROLL CHILL OUT', 41),
      guarantee: 16000,
      overlayBase: 12000,
      overlayPerHead: 100,
    };
    expect(livePrizePool(closedNight, [closedNight], [])).toBe(16000);
    const battle = {
      ...closed('team', 'TEAM BATTLE', 20),
      isClosed: false,
      guarantee: 12000,
      overlayPerHead: 100,
    };
    expect(livePrizePool(battle, [battle], [])).toBe(12000);
  });

  it('reads the series average and the saved overlay for the lobby hint', () => {
    const older = { ...closed('old', 'CHILL OUT', 10), startDate: '2026-09-01', overlayPerHead: 80 };
    const newer = { ...closed('new', 'FREEROLL CHILL OUT', 20), startDate: '2026-10-01', overlayPerHead: 100 };
    const open = { ...closed('open', 'CHILL OUT', 0), isClosed: false, participants: [] };
    expect(lobbyOverlayFigures(open, [open, older, newer])).toEqual({ people: 15, perHead: 100 });
    expect(lobbyOverlayFigures({ ...open, overlayPerHead: 120 }, [open, older, newer])).toEqual({
      people: 15,
      perHead: 120,
    });
  });
});
