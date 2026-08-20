import { useLocation, useNavigate } from 'react-router-dom';
import { useBlinds } from '../context/BlindsContext';
import { useTournaments } from '../context/TournamentContext';
import { useBindPokerTimer } from '../hooks/useBindPokerTimer';
import { autoAvgStack, remainingPlayers } from '../lib/tournamentStats';
import { openTournaments, timerPathForStructure, timerPathForTournament } from '../lib/timerTournament';

const FIELD_CLASS =
  'w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#D99962]/60 transition-colors';
const LABEL_CLASS =
  'block text-[10px] font-700 uppercase tracking-[0.16em] mb-1 text-[#D99962]';

/** Avg stack, chipleader, and the TournamentContext event bound by id. */
export function TimerSessionFields() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tournaments } = useTournaments();
  const { bindTournament } = useBindPokerTimer();
  const {
    activeStructure,
    avgStackOverride,
    chipleaderId,
    linkedTournamentId,
    totalEntries,
    rebuyCount,
    setAvgStackOverride,
    setChipleader,
    setTotalEntries,
    setRebuyCount,
    chipleaderStack,
    setChipleaderStack,
  } = useBlinds();

  const onTimerPage = location.pathname === '/admin/blinds/timer';
  const tournament = tournaments.find((row) => row.id === linkedTournamentId);
  const remaining = remainingPlayers(tournament);
  const autoStack = autoAvgStack(tournament);

  const selectable = (() => {
    const open = openTournaments(tournaments);
    if (tournament && tournament.isClosed && !open.some((row) => row.id === tournament.id)) {
      return [tournament, ...open];
    }
    return open;
  })();

  const selectTournament = (tournamentId: string) => {
    if (!tournamentId) {
      bindTournament(null);
      if (onTimerPage && activeStructure) {
        navigate(timerPathForStructure(activeStructure.id), { replace: true });
      }
      return;
    }
    bindTournament(tournamentId);
    if (onTimerPage) navigate(timerPathForTournament(tournamentId), { replace: true });
  };

  return (
    <div
      className="rounded-2xl p-3 space-y-3 mb-4"
      style={{ background: '#2A211D', border: '1px solid rgba(217,153,98,0.22)' }}
    >
      <p className="text-[11px] font-800 uppercase tracking-[0.16em]" style={{ color: '#F2D8A7' }}>
        Сессия текущего таймера
      </p>

      <label className="block">
        <span className={LABEL_CLASS}>Турнир</span>
        <select
          value={linkedTournamentId ?? ''}
          onChange={(event) => selectTournament(event.target.value)}
          className={FIELD_CLASS}
        >
          <option value="">Не выбран</option>
          {selectable.map((row) => (
            <option key={row.id} value={row.id}>
              {row.title}
              {row.isClosed ? ' (закрыт)' : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={LABEL_CLASS}>Всего входов (Игроки)</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Не задано"
          value={totalEntries ?? ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              setTotalEntries(null);
              return;
            }
            const next = Number(raw);
            setTotalEntries(Number.isFinite(next) ? Math.max(0, Math.floor(next)) : null);
          }}
          className={FIELD_CLASS}
        />
      </label>

      <label className="block">
        <span className={LABEL_CLASS}>Кол-во ребаев</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="0"
          value={rebuyCount ?? ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              setRebuyCount(null);
              return;
            }
            const next = Number(raw);
            setRebuyCount(Number.isFinite(next) ? Math.max(0, Math.floor(next)) : null);
          }}
          className={FIELD_CLASS}
        />
      </label>

      <label className="block">
        <span className={LABEL_CLASS}>Средний стек (ручной ввод)</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder={autoStack > 0 ? `Авто: ${autoStack.toLocaleString('ru-RU')}` : 'Авто'}
          value={avgStackOverride ?? ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              setAvgStackOverride(null);
              return;
            }
            const next = Number(raw);
            setAvgStackOverride(Number.isFinite(next) ? next : null);
          }}
          className={FIELD_CLASS}
        />
      </label>

      <label className="block">
        <span className={LABEL_CLASS}>Выбрать чиплидера</span>
        <select
          value={chipleaderId ?? ''}
          onChange={(e) => setChipleader(e.target.value || null)}
          disabled={!tournament}
          className={FIELD_CLASS}
        >
          <option value="">Не выбран</option>
          {remaining.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nickname}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={LABEL_CLASS}>Стек чиплидера</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Не задано"
          disabled={!chipleaderId}
          value={chipleaderStack ?? ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              setChipleaderStack(null);
              return;
            }
            const next = Number(raw);
            setChipleaderStack(Number.isFinite(next) ? Math.max(0, Math.round(next)) : null);
          }}
          className={`${FIELD_CLASS} disabled:opacity-40`}
        />
      </label>
    </div>
  );
}
