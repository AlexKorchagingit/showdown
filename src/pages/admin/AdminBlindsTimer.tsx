import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Settings,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react';
import { TimerSessionFields } from '../../components/TimerSessionFields';
import { useBlinds } from '../../context/BlindsContext';
import { useProfile } from '../../context/ProfileContext';
import { useTournaments } from '../../context/TournamentContext';
import {
  durationSeconds,
  formatBlinds,
  formatEta,
  isLateRegClosed,
  secondsUntilLateRegEnd,
  secondsUntilNextBreak,
} from '../../data/blindStructures';
import { calculatePayouts } from '../../data/prizeStructure';
import { asset } from '../../lib/assets';
import { isAppFullscreen, toggleAppFullscreen } from '../../lib/fullscreen';
import { characterImageForPlayer } from '../../lib/playerCharacter';
import {
  autoAvgStack,
  remainingPlayers,
  tournamentPlayerCounts,
} from '../../lib/tournamentStats';

const SETTINGS_ROUTE = '/admin/blinds/settings';
const CIRCLE_SIZE = 360;
const STROKE = 10;
const RADIUS = 158;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GOLD_TEXT = 'text-transparent bg-clip-text bg-gradient-to-r from-[#D99962] to-[#F2D8A7]';
const GLASS =
  'bg-white/[0.03] border border-white/[0.05] rounded-2xl p-5 backdrop-blur-sm';
const NOISE_BG = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`,
)}")`;

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
      className="bg-white/5 hover:bg-white/20 text-white/80 hover:text-[#D99962] p-4 rounded-full transition-colors active:scale-95 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-white/80"
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
    adjustSeconds,
    linkedTournamentId,
    setLinkedTournament,
    avgStackOverride,
    chipleaderId,
    setChipleader,
    totalEntries,
    rebuyCount,
    chipleaderStack,
  } = useBlinds();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(isAppFullscreen);

  const requestedId =
    searchParams.get('structure') ??
    structures.find((s) => s.name === tournaments.find((t) => t.id === linkedTournamentId)?.title)?.id ??
    structures[0]?.id ??
    null;

  useEffect(() => {
    ensureTimer(requestedId);
  }, [requestedId, ensureTimer]);

  useEffect(() => {
    const sync = () => setFullscreen(isAppFullscreen());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const structure = activeStructure ?? structures.find((s) => s.id === requestedId);
  const tournament = tournaments.find((t) => t.id === linkedTournamentId);
  const { remaining } = tournamentPlayerCounts(tournament);
  const avgStack = avgStackOverride ?? autoAvgStack(tournament);
  const seated = remainingPlayers(tournament);
  const chipleader = seated.find((p) => p.id === chipleaderId) ?? null;
  const eventTitle = structure?.name ?? '';

  useEffect(() => {
    if (!structure) return;
    const match = tournaments.find((t) => t.title === structure.name);
    const nextId = match?.id ?? null;
    if (nextId !== linkedTournamentId) setLinkedTournament(nextId);
  }, [structure, tournaments, linkedTournamentId, setLinkedTournament]);

  const timeToNextBreak = useMemo(
    () =>
      structure
        ? secondsUntilNextBreak(structure.levels, levelIndex, secondsLeft)
        : null,
    [structure, levelIndex, secondsLeft],
  );
  const timeToLateRegEnd = useMemo(
    () =>
      structure
        ? secondsUntilLateRegEnd(structure.levels, levelIndex, secondsLeft)
        : null,
    [structure, levelIndex, secondsLeft],
  );
  const lateRegClosed = useMemo(
    () => (structure ? isLateRegClosed(structure.levels, levelIndex) : false),
    [structure, levelIndex],
  );

  const prizePool = tournament?.guarantee ?? structure?.guarantee ?? 0;
  const hasEntries = totalEntries != null;
  const fieldSize = hasEntries ? totalEntries : 0;
  const payouts = useMemo(
    () => (hasEntries ? calculatePayouts(fieldSize, prizePool) : []),
    [hasEntries, fieldSize, prizePool],
  );

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
  const levelSeconds = durationSeconds(
    currentLevel,
    currentLevel?.durationMinutes ?? structure.levelDuration,
  );
  const remainingRatio = Math.min(1, Math.max(0, secondsLeft / Math.max(1, levelSeconds)));
  const dashOffset = CIRCUMFERENCE * (1 - remainingRatio);
  const isBreak = currentLevel?.isBreak === true;
  const levelNumber = currentLevel?.level ?? levelIndex + 1;
  const blindsLabel = isBreak
    ? 'Перерыв'
    : currentLevel
      ? `${currentLevel.smallBlind.toLocaleString('ru-RU')} / ${currentLevel.bigBlind.toLocaleString('ru-RU')}`
      : '—';
  const anteLabel = isBreak
    ? `${currentLevel?.durationMinutes ?? 20} мин`
    : currentLevel && currentLevel.ante > 0
      ? `Ante ${currentLevel.ante.toLocaleString('ru-RU')}`
      : 'Ante —';
  const levelBadge = isBreak
    ? currentLevel?.isLateRegEnd
      ? 'Конец реги'
      : 'Break'
    : `Level ${levelNumber}`;

  return (
    <div className="fixed inset-0 z-[100] text-white bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#231A16] to-[#0A0908]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{ backgroundImage: NOISE_BG }}
        aria-hidden
      />

      <div className="relative flex w-full h-full gap-4 px-4 pt-6 pb-28">
        <div className="w-[240px] md:w-[280px] shrink-0 overflow-y-auto">
          <section className={`${GLASS} h-full`}>
            <p className="text-[11px] md:text-xs font-800 uppercase tracking-[0.2em] text-[#D99962]">
              Гарантия очков
            </p>
            <p className="text-4xl md:text-5xl font-black mt-3 leading-none tabular-nums text-[#F2D8A7]">
              {prizePool.toLocaleString('ru-RU')}
            </p>

            <div className="mt-5 tabular-nums">
              {hasEntries ? (
                <>
                  <p className="text-xs font-700 uppercase tracking-[0.14em] text-white/40 mb-3">
                    В призах: {payouts.length} чел. (30%)
                  </p>
                  {payouts.length === 0 ? (
                    <p className="text-sm font-600 text-white/40">Нет призовых мест</p>
                  ) : (
                    <div className="space-y-2.5">
                      {payouts.map(({ place, points }) => (
                        <div key={place} className="flex justify-between items-baseline gap-3">
                          <span className="text-sm md:text-base font-700 text-white/55">{place} место</span>
                          <span className="text-base md:text-lg font-black tabular-nums text-[#D99962]">
                            {points.toLocaleString('ru-RU')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[#8c8c88] italic text-sm">Идет подсчет распределения очков...</p>
              )}
            </div>
          </section>
        </div>

        <div className="w-[220px] md:w-[260px] shrink-0 flex flex-col gap-4 overflow-y-auto">
          {hasEntries && (
            <section className={`${GLASS} text-center`}>
              <p className="text-[10px] md:text-[11px] font-800 uppercase tracking-[0.18em] text-white/40">
                Игроки (в игре)
              </p>
              <p className="text-4xl md:text-5xl font-black text-white mt-2 leading-none tabular-nums">
                {remaining}
                <span className="text-white/35"> / {totalEntries}</span>
              </p>
              {rebuyCount != null && rebuyCount > 0 && (
                <p className="text-[11px] font-600 text-white/40 mt-2">Ребаев: {rebuyCount}</p>
              )}
            </section>
          )}

          <section className={`${GLASS} text-center`}>
            <p className="text-[10px] md:text-[11px] font-800 uppercase tracking-[0.18em] text-white/40">
              Средний стек
            </p>
            <p className="text-4xl md:text-5xl font-black mt-2 leading-none tabular-nums text-[#F2D8A7]">
              {avgStack.toLocaleString('ru-RU')}
            </p>
          </section>

          <section className={`${GLASS} text-center mt-auto`}>
            <p
              className={`text-sm font-900 uppercase tracking-[0.28em] drop-shadow-[0_0_10px_rgba(217,153,98,0.65)] ${GOLD_TEXT}`}
            >
              Chipleader
            </p>
            {chipleader ? (
              <>
                <div className="w-32 h-32 rounded-full ring-2 ring-[#D99962] shadow-[0_0_15px_rgba(217,153,98,0.4)] overflow-hidden mx-auto my-2 bg-[#1A1411]">
                  <img
                    src={characterImageForPlayer(chipleader.id, chipleader.nickname, equippedChar)}
                    alt=""
                    className="w-full h-full object-cover object-top pointer-events-none select-none"
                  />
                </div>
                <p className="text-xl font-black text-white leading-tight">{chipleader.nickname}</p>
                <p className="text-2xl md:text-3xl font-black tabular-nums mt-1 text-[#D99962]">
                  {chipleaderStack != null ? chipleaderStack.toLocaleString('ru-RU') : '—'}
                </p>
              </>
            ) : (
              <p className="text-sm font-600 uppercase tracking-wide mt-4 text-[#6B6360]">
                Чиплидер не выбран
              </p>
            )}
          </section>
        </div>

        <div className="flex-1 min-w-0 flex flex-col items-center justify-center px-2">
          <p className="text-[13px] md:text-[15px] font-800 uppercase tracking-[0.4em] text-[#D99962]">
            Showdown
          </p>
          <h1
            className={`text-2xl md:text-3xl font-black uppercase tracking-wide text-center mt-1 leading-tight ${GOLD_TEXT}`}
          >
            {eventTitle}
          </h1>

          <div className="relative my-4 w-[min(78vw,26rem)] md:w-[min(44vw,30rem)] aspect-square">
            <svg
              viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}
              className="w-full h-full -rotate-90 pointer-events-none"
              aria-hidden
            >
              <defs>
                <filter id="timer-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
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
                filter="url(#timer-glow)"
                style={{ transition: 'stroke-dashoffset 0.25s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 pointer-events-none">
              <span className="bg-[#D99962]/20 text-[#D99962] px-4 py-1 rounded-full text-sm font-bold tracking-widest uppercase">
                {levelBadge}
              </span>
              <p className="text-3xl md:text-5xl font-black text-white mt-3 leading-none">{blindsLabel}</p>
              <p className="text-lg md:text-2xl font-700 mt-1 text-[#F2D8A7]">{anteLabel}</p>
              <p className="text-[4.2rem] md:text-[6.5rem] font-black leading-none tabular-nums mt-2 drop-shadow-[0_0_20px_rgba(217,153,98,0.5)]">
                {formatClock(secondsLeft)}
              </p>
            </div>
            <button
              type="button"
              className="absolute left-0 top-0 z-10 h-full w-1/2 cursor-pointer bg-transparent"
              aria-label="Минус одна минута"
              onClick={() => adjustSeconds(-60)}
            />
            <button
              type="button"
              className="absolute right-0 top-0 z-10 h-full w-1/2 cursor-pointer bg-transparent"
              aria-label="Плюс одна минута"
              onClick={() => adjustSeconds(60)}
            />
          </div>

          <p className="text-2xl font-bold text-white/70">
            Next Blinds:{' '}
            <span className="text-[#D99962]">
              {nextLevel ? formatBlinds(nextLevel) : 'финальный уровень'}
            </span>
          </p>
        </div>

        <div className="w-52 md:w-64 shrink-0 flex flex-col items-end gap-4">
          <img
            src={asset('/SD.png')}
            alt="Showdown"
            className="h-24 md:h-32 w-auto object-contain opacity-90"
          />
          <section className={`${GLASS} w-full text-right space-y-3`}>
            {timeToNextBreak != null && (
              <div>
                <p className="text-[10px] font-800 uppercase tracking-[0.16em] text-white/40">
                  Перерыв через
                </p>
                <p className="text-lg md:text-xl font-black tabular-nums text-white mt-0.5">
                  {formatEta(timeToNextBreak)}
                </p>
              </div>
            )}
            {lateRegClosed ? (
              <p className="text-sm font-bold text-red-500">Регистрация закрыта</p>
            ) : timeToLateRegEnd != null ? (
              <div>
                <p className="text-[10px] font-800 uppercase tracking-[0.16em] text-white/40">
                  Поздняя регистрация
                </p>
                <p className="text-lg md:text-xl font-black tabular-nums text-white mt-0.5">
                  {formatEta(timeToLateRegEnd)}
                </p>
              </div>
            ) : null}
            {timeToNextBreak == null && !lateRegClosed && timeToLateRegEnd == null && (
              <p className="text-sm text-white/35">Тайминги не заданы</p>
            )}
          </section>
        </div>
      </div>

      <div className="absolute bottom-5 right-5 z-30 flex items-center gap-2">
        <ControlButton label="Назад к структурам" onClick={() => navigate(SETTINGS_ROUTE)}>
          <ArrowLeft size={22} strokeWidth={2.2} />
        </ControlButton>
        <ControlButton label="Настройки" onClick={() => setSettingsOpen(true)}>
          <Settings size={22} strokeWidth={2.2} />
        </ControlButton>
        <ControlButton
          label="Предыдущий уровень"
          onClick={() => skipLevel(-1)}
          disabled={levelIndex <= 0}
        >
          <SkipBack size={22} strokeWidth={2.2} />
        </ControlButton>
        <ControlButton label={isRunning ? 'Пауза' : 'Запустить'} onClick={() => setRunning(!isRunning)}>
          {isRunning ? (
            <Pause size={22} strokeWidth={2.2} fill="currentColor" />
          ) : (
            <Play size={22} strokeWidth={2.2} fill="currentColor" className="pl-1" />
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
          label={fullscreen ? 'Выйти из полноэкранного режима' : 'Полный экран'}
          onClick={() => {
            void toggleAppFullscreen().then(() => setFullscreen(isAppFullscreen()));
          }}
        >
          {fullscreen ? (
            <Minimize size={22} strokeWidth={2.2} />
          ) : (
            <Maximize size={22} strokeWidth={2.2} />
          )}
        </ControlButton>
      </div>

      {settingsOpen &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-end justify-center">
            <button
              type="button"
              className="absolute inset-0 bg-black/65"
              aria-label="Закрыть настройки"
              onClick={() => setSettingsOpen(false)}
            />
            <div
              className="relative w-full max-w-[480px] max-h-[80vh] rounded-t-3xl px-4 pt-4 pb-8 overflow-y-auto"
              style={{ background: '#1A1411', border: '1px solid rgba(217,153,98,0.28)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-800 uppercase tracking-wide text-white">Настройки таймера</h2>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                  aria-label="Закрыть"
                >
                  <X size={16} style={{ color: '#A39B98' }} />
                </button>
              </div>
              <TimerSessionFields structureName={structure.name} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
