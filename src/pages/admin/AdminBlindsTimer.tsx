import { useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Pause, Play, RotateCcw, Settings, SkipBack, SkipForward } from 'lucide-react';
import { useBlinds } from '../../context/BlindsContext';
import { useProfile } from '../../context/ProfileContext';
import { useTournaments } from '../../context/TournamentContext';
import { durationSeconds, formatBlinds } from '../../data/blindStructures';
import { asset } from '../../lib/assets';
import { characterImageForPlayer } from '../../lib/playerCharacter';
import {
  autoAvgStack,
  remainingPlayers,
  tournamentPlayerCounts,
} from '../../lib/tournamentStats';

const SETTINGS_ROUTE = '/admin/blinds/settings';
const CIRCLE_SIZE = 320;
const STROKE = 5;
const RADIUS = (CIRCLE_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GOLD_TEXT = 'text-transparent bg-clip-text bg-gradient-to-r from-[#D99962] to-[#F2D8A7]';

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function ControlButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white/70 p-4 rounded-full transition-colors active:scale-95 disabled:opacity-30 disabled:hover:bg-white/10"
    >
      {children}
    </button>
  );
}

export function AdminBlindsTimer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { equippedChar } = useProfile();
  const { tournaments } = useTournaments();
  const {
    structures,
    activeStructure,
    levelIndex,
    secondsLeft,
    isRunning,
    ensureTimer,
    setRunning,
    restartLevel,
    skipLevel,
    linkedTournamentId,
    setLinkedTournament,
    avgStackOverride,
    chipleaderId,
    setChipleader,
  } = useBlinds();

  const requestedId = searchParams.get('structure') ?? structures[0]?.id ?? null;

  useEffect(() => {
    ensureTimer(requestedId);
  }, [requestedId, ensureTimer]);

  useEffect(() => {
    if (linkedTournamentId) return;
    const fallback = tournaments.find((t) => !t.isClosed && t.participants.length > 0) ?? tournaments[0];
    if (fallback) setLinkedTournament(fallback.id);
  }, [linkedTournamentId, tournaments, setLinkedTournament]);

  const structure = activeStructure ?? structures.find((s) => s.id === requestedId);
  const tournament = tournaments.find((t) => t.id === linkedTournamentId);
  const { remaining, registered } = tournamentPlayerCounts(tournament);
  const avgStack = avgStackOverride ?? autoAvgStack(tournament);
  const seated = remainingPlayers(tournament);
  const chipleader = seated.find((p) => p.id === chipleaderId) ?? null;

  useEffect(() => {
    if (!chipleaderId || !tournament) return;
    const stillSeated = tournament.participants.some(
      (p) => p.id === chipleaderId && typeof p.place !== 'number',
    );
    if (!stillSeated) setChipleader(null);
  }, [chipleaderId, tournament, setChipleader]);

  if (!structure) return <Navigate to={SETTINGS_ROUTE} replace />;

  const currentLevel = structure.levels[levelIndex];
  const nextLevel = structure.levels[levelIndex + 1];
  const levelSeconds = durationSeconds(currentLevel, structure.levelDuration);
  const remainingRatio = Math.min(1, Math.max(0, secondsLeft / levelSeconds));
  const dashOffset = CIRCUMFERENCE * (1 - remainingRatio);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0A0908]">
      <div className="flex flex-col md:flex-row w-full h-full text-white">
        <div className="w-full md:w-1/4 bg-[#110b09]/50 p-4 md:p-6 border-b md:border-b-0 md:border-r border-white/10 overflow-y-auto">
          <h2
            className="text-[12px] font-800 uppercase tracking-[0.2em] mb-3"
            style={{ color: '#D99962' }}
          >
            Информация о турнире
          </h2>
          <p className="text-[15px] font-700 text-white leading-snug">
            Осталось игроков:{' '}
            <span style={{ color: '#F2D8A7' }}>
              {remaining} / {registered}
            </span>
          </p>
          <p className="text-[15px] font-700 text-white mt-2 leading-snug">
            Средний стек (Avg Stack):{' '}
            <span style={{ color: '#F2D8A7' }}>{avgStack.toLocaleString('ru-RU')}</span>
          </p>
          {tournament && (
            <p className="text-[11px] font-500 mt-2" style={{ color: '#8c8c88' }}>
              {tournament.title}
            </p>
          )}

          <h2
            className="text-[12px] font-800 uppercase tracking-[0.2em] mt-6 mb-3"
            style={{ color: '#D99962' }}
          >
            Гарантия очков
          </h2>

          <p className="text-2xl font-black mb-4" style={{ color: '#F2D8A7' }}>
            {structure.guarantee.toLocaleString('ru-RU')}
          </p>

          <div className="flex flex-row md:flex-col gap-x-6 gap-y-2.5 flex-wrap">
            {structure.payouts.map(({ place, share }) => (
              <div key={place} className="flex items-baseline gap-2">
                <span className="text-[13px] font-600 text-white/60">{place} место</span>
                <span className="text-[15px] font-bold" style={{ color: '#D99962' }}>
                  {share}%
                </span>
                <span className="text-[12px] font-500 text-white/40">
                  {Math.round((structure.guarantee * share) / 100).toLocaleString('ru-RU')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative p-4 min-h-0">
          <p
            className="text-[13px] font-800 uppercase tracking-[0.35em]"
            style={{ color: '#D99962' }}
          >
            Showdown
          </p>
          <h1 className="text-xl md:text-3xl font-black uppercase tracking-wide text-center mt-1">
            {structure.name}
          </h1>

          <p className="text-[13px] font-700 uppercase tracking-[0.2em] mt-4" style={{ color: '#D99962' }}>
            Level {currentLevel?.level ?? levelIndex + 1}
          </p>
          <p className="text-lg md:text-2xl font-bold text-white mt-1">
            {formatBlinds(currentLevel)}
          </p>

          <div className="relative my-3 w-[min(78vw,20rem)] md:w-[min(56vw,26rem)] aspect-square">
            <svg
              viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}
              className="w-full h-full -rotate-90"
              aria-hidden
            >
              <circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={STROKE}
              />
              <circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="#D99962"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 0.25s linear' }}
              />
            </svg>
            <p className="absolute inset-0 flex items-center justify-center text-[16vw] md:text-[6.5rem] font-black leading-none tabular-nums">
              {formatClock(secondsLeft)}
            </p>
          </div>

          <p className="text-[13px] font-500 text-white/40">
            Next Blinds: {nextLevel ? formatBlinds(nextLevel) : 'финальный уровень'}
          </p>

          <div className="absolute bottom-6 right-6 flex flex-wrap justify-end gap-3">
            <ControlButton
              label="Предыдущий уровень"
              onClick={() => skipLevel(-1)}
              disabled={levelIndex <= 0}
            >
              <SkipBack size={22} strokeWidth={2.2} />
            </ControlButton>

            <ControlButton
              label={isRunning ? 'Пауза' : 'Запустить'}
              onClick={() => setRunning(!isRunning)}
            >
              {isRunning ? (
                <Pause size={22} strokeWidth={2.2} fill="currentColor" />
              ) : (
                <Play size={22} strokeWidth={2.2} fill="currentColor" />
              )}
            </ControlButton>

            <ControlButton
              label="Следующий уровень"
              onClick={() => skipLevel(1)}
              disabled={levelIndex >= structure.levels.length - 1}
            >
              <SkipForward size={22} strokeWidth={2.2} />
            </ControlButton>

            <ControlButton label="Повторить уровень" onClick={restartLevel}>
              <RotateCcw size={22} strokeWidth={2.2} />
            </ControlButton>

            <ControlButton
              label="Настройки"
              onClick={() => navigate(`${SETTINGS_ROUTE}?structure=${structure.id}`)}
            >
              <Settings size={22} strokeWidth={2.2} />
            </ControlButton>
          </div>
        </div>

        <div className="w-full md:w-1/4 bg-[#110b09]/50 p-4 md:p-6 border-t md:border-t-0 md:border-l border-white/10 relative overflow-hidden min-h-[220px] md:min-h-0">
          {chipleader ? (
            <>
              <h2
                className={`relative z-10 text-[13px] font-900 uppercase tracking-[0.28em] drop-shadow-[0_0_10px_rgba(217,153,98,0.65)] ${GOLD_TEXT}`}
              >
                Chipleader
              </h2>
              <p className="relative z-10 text-2xl md:text-3xl font-black text-white mt-2 leading-tight">
                {chipleader.nickname}
              </p>
              <img
                src={characterImageForPlayer(chipleader.id, chipleader.nickname, equippedChar)}
                alt=""
                className="absolute inset-x-0 bottom-0 h-[82%] w-full object-contain object-bottom pointer-events-none select-none"
              />
            </>
          ) : (
            <div className="h-full min-h-[180px] flex flex-col items-center justify-center">
              <img
                src={asset('/SD.png')}
                alt="Showdown"
                className="max-h-40 w-auto object-contain opacity-80"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
