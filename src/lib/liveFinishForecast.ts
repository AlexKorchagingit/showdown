import type { Transaction } from '../types/finance';
import type { Tournament } from '../types/tournament';
import { timerChipTotals } from './chipStacks';
import {
  elapsedSinceStart,
  forecastEndMinutes,
  seriesKeyOf,
  tournamentHasStarted,
  typicalEndMinutes,
} from './finishForecast';
import { seriesAverages } from './overlayPlan';
import { clockToMinutes } from './playedClock';
import { tournamentPlayerCounts } from './tournamentStats';

/** The same end the timer prints as «Конец ≈». Null before the advertised start. */
export function liveForecastEndMinutes(input: {
  tournament: Tournament;
  tournaments: readonly Tournament[];
  transactions: readonly Transaction[];
  countsKnown: boolean;
  now?: Date;
}): { forecastEnd: number; targetEnd: number; nowMinutes: number } | null {
  const { tournament } = input;
  const startClock = tournament.playedStart || tournament.startTime;
  if (!tournamentHasStarted(tournament.startDate, startClock, input.now)) return null;
  const series = seriesKeyOf(tournament.title);
  const stats = seriesAverages(tournament, input.tournaments, input.transactions);
  const normPeople = stats.nights > 0 ? Math.round(stats.people) : 17;
  const normRebuys = stats.nights > 0 ? Math.round(stats.rebuys) : 10;
  const normAddons = stats.nights > 0 ? Math.round(stats.addons) : 1;
  const chipTotals = timerChipTotals(tournament, undefined, [...input.transactions]);
  const { remaining, registered } = tournamentPlayerCounts(tournament);
  const startMinutes = clockToMinutes(startClock);
  const elapsed = elapsedSinceStart(tournament.startDate, startClock, input.now);
  const forecastEnd = forecastEndMinutes({
    startMinutes,
    series,
    field: registered,
    rebuys: input.countsKnown ? chipTotals.rebuys + chipTotals.rebuysBeyondLimit : normRebuys,
    addons: input.countsKnown ? chipTotals.addons : normAddons,
    normPeople,
    normRebuys,
    normAddons,
    elapsedMinutes: elapsed,
    playersLeft: remaining,
  });
  return {
    forecastEnd,
    targetEnd: typicalEndMinutes(startMinutes, series),
    nowMinutes: startMinutes + elapsed,
  };
}
