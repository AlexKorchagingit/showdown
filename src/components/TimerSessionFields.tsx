import { useBlinds } from '../context/BlindsContext';
import { useTournaments } from '../context/TournamentContext';
import { autoAvgStack, remainingPlayers } from '../lib/tournamentStats';

const FIELD_CLASS =
  'w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#D99962]/60 transition-colors';
const LABEL_CLASS =
  'block text-[10px] font-700 uppercase tracking-[0.16em] mb-1 text-[#D99962]';

/** Tournament link, manual avg stack and chipleader — shared by blinds settings. */
export function TimerSessionFields() {
  const { tournaments } = useTournaments();
  const {
    linkedTournamentId,
    avgStackOverride,
    chipleaderId,
    setLinkedTournament,
    setAvgStackOverride,
    setChipleader,
  } = useBlinds();

  const tournament = tournaments.find((t) => t.id === linkedTournamentId);
  const remaining = remainingPlayers(tournament);
  const autoStack = autoAvgStack(tournament);

  return (
    <div
      className="rounded-2xl p-3 space-y-3 mb-4"
      style={{ background: '#2A211D', border: '1px solid rgba(217,153,98,0.22)' }}
    >
      <p className="text-[11px] font-800 uppercase tracking-[0.16em]" style={{ color: '#F2D8A7' }}>
        Сессия таймера
      </p>

      <label className="block">
        <span className={LABEL_CLASS}>Турнир</span>
        <select
          value={linkedTournamentId ?? ''}
          onChange={(e) => setLinkedTournament(e.target.value || null)}
          className={FIELD_CLASS}
        >
          <option value="">Не выбран</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
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
    </div>
  );
}
