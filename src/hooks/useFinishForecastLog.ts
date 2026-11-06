import { useEffect, useRef } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTournaments } from '../context/TournamentContext';
import { appendFinishForecast } from '../lib/finishForecastApi';
import { formatClockMinutes } from '../lib/finishForecast';
import { shouldRecordForecast } from '../lib/finishForecastLog';
import { liveForecastEndMinutes } from '../lib/liveFinishForecast';
import type { Tournament } from '../types/tournament';

/** While the timer or the cashier is open, keep a finish snapshot about every two hours. */
export function useFinishForecastLog(tournament: Tournament | undefined) {
  const { tournaments, rememberFinishForecasts } = useTournaments();
  const { transactions, isLoading: financeLoading } = useFinance();
  const inflight = useRef(false);

  useEffect(() => {
    if (!tournament || tournament.isClosed) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled || inflight.current) return;
      const countsKnown = !(financeLoading && transactions.length === 0);
      const finish = liveForecastEndMinutes({
        tournament,
        tournaments,
        transactions,
        countsKnown,
      });
      if (!finish || !shouldRecordForecast(tournament.finishForecasts ?? [])) return;
      inflight.current = true;
      const id = tournament.id;
      void appendFinishForecast(id, formatClockMinutes(finish.forecastEnd))
        .then((marks) => {
          if (!cancelled) rememberFinishForecasts(id, marks);
        })
        .catch(() => {})
        .finally(() => {
          inflight.current = false;
        });
    };
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [financeLoading, rememberFinishForecasts, tournament, tournaments, transactions]);
}
