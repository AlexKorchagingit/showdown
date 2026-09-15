import { useMemo } from 'react';
import { useBlinds } from '../context/BlindsContext';
import { useFinance } from '../context/FinanceContext';
import { useTournaments } from '../context/TournamentContext';
import { timerChipTotals } from '../lib/chipStacks';
import { remainingPlayers } from '../lib/tournamentStats';

const FIELD_CLASS =
  'w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#D99962]/60 transition-colors';
const READONLY_CLASS = `${FIELD_CLASS} opacity-80 cursor-default`;
const LABEL_CLASS =
  'block text-[10px] font-700 uppercase tracking-[0.16em] mb-1 text-[#D99962]';
const HINT_CLASS = 'mt-1 text-[10px] font-600 leading-snug text-white/40';

function chips(value: number): string {
  return value.toLocaleString('ru-RU');
}

/** Chipleader picker plus the cashier-derived rebuy count and average stack. */
export function TimerSessionFields() {
  const { tournaments } = useTournaments();
  const { transactions, isLoading: financeLoading, loadError: financeError } = useFinance();
  const {
    activeStructure,
    chipleaderId,
    linkedTournamentId,
    setChipleader,
    chipleaderStack,
    setChipleaderStack,
  } = useBlinds();

  const tournament = tournaments.find((row) => row.id === linkedTournamentId);
  const remaining = remainingPlayers(tournament);
  const totals = useMemo(
    () => timerChipTotals(tournament, activeStructure, transactions),
    [tournament, activeStructure, transactions],
  );

  return (
    <div
      className="rounded-2xl p-3 space-y-3 mb-4"
      style={{ background: '#2A211D', border: '1px solid rgba(217,153,98,0.22)' }}
    >
      <p className="text-[11px] font-800 uppercase tracking-[0.16em]" style={{ color: '#F2D8A7' }}>
        Сессия текущего таймера
      </p>

      {tournament ? (
        <p className="text-[11px] font-600 text-white/50">
          Касса: {totals.entries} · в игре: {totals.active}
        </p>
      ) : (
        <p className="text-[11px] font-600 text-white/50">Турнир не определён</p>
      )}

      {financeError ? (
        <p className="text-[11px] font-600 leading-snug text-red-400">
          Касса не загрузилась, ребаи и средний стек могут быть неполными.
        </p>
      ) : null}

      <label className="block">
        <span className={LABEL_CLASS}>Кол-во ребаев и аддонов</span>
        <input
          type="text"
          readOnly
          tabIndex={-1}
          value={financeLoading ? '…' : `${totals.rebuys} + ${totals.addons}`}
          aria-label="Ребаи и аддоны считаются по кассе турнира"
          className={READONLY_CLASS}
        />
        <p className={HINT_CLASS}>
          Ребаев: {totals.rebuys} · аддонов: {totals.addons}. Считается по кассе турнира.
        </p>
      </label>

      <label className="block">
        <span className={LABEL_CLASS}>Средний стек</span>
        <input
          type="text"
          readOnly
          tabIndex={-1}
          value={financeLoading ? '…' : chips(totals.avgStack)}
          aria-label="Средний стек считается автоматически"
          className={READONLY_CLASS}
        />
        <p className={HINT_CLASS}>
          {totals.active > 0
            ? `Фишек в игре: ${chips(totals.totalChips)} на ${totals.active} игроков. ` +
              `Старт ${chips(totals.startingStack)} · ребай ${chips(totals.rebuyStack)} · аддон ${chips(totals.addonStack)}.`
            : 'Появится, когда в кассе будут игроки без места.'}
          {totals.usesStartingStackFallback && totals.entries > 0
            ? ' Стек за ребай и аддон не указан в комментариях структуры — берём стартовый.'
            : ''}
        </p>
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
