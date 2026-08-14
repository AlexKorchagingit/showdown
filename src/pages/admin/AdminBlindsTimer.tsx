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
const STROKE = 8;
const RADIUS = 160;
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
      className="bg-white/5 hover:bg-white/10 text-white/50 p-4 rounded-full transition-colors active:scale-95 disabled:opacity-30 disabled:hover:bg-white/5"
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
  const { remaining, registered } = tournamentPlayerCounts(tournament);
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
  const levelSeconds = durationSeconds(currentLevel, currentLevel?.durationMinutes ?? structure.levelDuration);
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

  return (
    <div className="fixed inset-0 z-[100] bg-[#0A0908] text-white">
      <div className="flex w-full h-full">
        <div className="w-[40%] min-w-[240px] max-w-[560px] flex flex-col px-5 pt-8 pb-28 overflow-y-auto">
          <p className="text-lg md:text-xl font-900 uppercase tracking-[0.18em]" style={{ color: '#D99962' }}>
            Гарантия очков
          </p>
          <p className="text-5xl md:text-6xl font-black mt-2 leading-none" style={{ color: '#F2D8A7' }}>
            {structure.guarantee.toLocaleString('ru-RU')}
          </p>

          <div className="mt-6 flex flex-col xl:flex-row gap-6 xl:gap-8">
            <div className="flex-1 space-y-2.5 min-w-0">
              {structure.payouts.map(({ place, share }) => (
                <div key={place} className="flex items-baseline gap-2">
                  <span className="text-base md:text-lg font-700 text-white/70">{place} место</span>
                  <span className="text-lg md:text-xl font-black" style={{ color: '#D99962' }}>
                    {share}%
                  </span>
                  <span className="text-sm md:text-base font-600 text-white/45">
                    {Math.round((structure.guarantee * share) / 100).toLocaleString('ru-RU')}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[12px] md:text-sm font-800 uppercase tracking-[0.16em]" style={{ color: '#D99962' }}>
                Осталось игроков
              </p>
              <p className="text-3xl md:text-5xl font-black text-white mt-1 leading-none tabular-nums">
                {remaining}
                <span className="text-xl md:text-2xl font-700 text-white/45"> / {registered}</span>
              </p>
              <p
                className="text-[12px] md:text-sm font-800 uppercase tracking-[0.16em] mt-4"
                style={{ color: '#D99962' }}
              >
                Средний стек
              </p>
              <p className="text-3xl md:text-5xl font-black mt-1 leading-none tabular-nums" style={{ color: '#F2D8A7' }}>
                {avgStack.toLocaleString('ru-RU')}
              </p>

              <div className="mt-6">
                {chipleader ? (
                  <div className="relative">
                    <p
                      className={`relative z-10 text-sm md:text-base font-900 uppercase tracking-[0.28em] drop-shadow-[0_0_10px_rgba(217,153,98,0.65)] ${GOLD_TEXT}`}
                    >
                      Chipleader
                    </p>
                    <p className="relative z-10 text-2xl md:text-3xl font-black text-white mt-1 leading-tight">
                      {chipleader.nickname}
                    </p>
                    <div className="relative mt-3 w-fit">
                      <div className="absolute inset-0 bg-[#D99962]/20 blur-[30px] -z-10 rounded-full" />
                      <img
                        src={characterImageForPlayer(chipleader.id, chipleader.nickname, equippedChar)}
                        alt=""
                        className="relative z-10 h-48 md:h-56 w-auto object-contain pointer-events-none select-none"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm font-600 uppercase tracking-wide" style={{ color: '#6B6360' }}>
                    Чиплидер не выбран
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col items-center justify-center relative px-3 py-6 pb-28">
          <p className="text-[13px] md:text-[15px] font-800 uppercase tracking-[0.4em]" style={{ color: '#D99962' }}>
            Showdown
          </p>
          <h1
            className={`text-2xl md:text-3xl font-black uppercase tracking-wide text-center mt-1 leading-tight ${GOLD_TEXT}`}
          >
            {eventTitle}
          </h1>

          <div className="relative my-4 w-[min(86vw,28rem)] md:w-[min(48vw,32rem)] aspect-square">
            <svg
              viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}
              className="w-full h-full -rotate-90 pointer-events-none"
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
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 pointer-events-none">
              <p className="text-2xl md:text-4xl font-black uppercase tracking-[0.18em]" style={{ color: '#D99962' }}>
                {isBreak
                  ? currentLevel?.isLateRegEnd
                    ? 'Конец реги'
                    : 'Break'
                  : `Level ${levelNumber}`}
              </p>
              <p className="text-4xl md:text-6xl font-black text-white mt-1 leading-none">{blindsLabel}</p>
              <p className="text-xl md:text-3xl font-700 mt-1" style={{ color: '#F2D8A7' }}>
                {anteLabel}
              </p>
              <p className="text-[4.5rem] md:text-[7rem] font-black leading-none tabular-nums mt-2">
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

          <p className="text-xl md:text-2xl font-bold text-white/70">
            Next Blinds: {nextLevel ? formatBlinds(nextLevel) : 'финальный уровень'}
          </p>
        </div>

        <div className="w-44 md:w-60 shrink-0 pt-5 pr-4 pb-28 flex flex-col items-end gap-4">
          <img
            src={asset('/SD.png')}
            alt="Showdown"
            className="h-20 md:h-28 w-auto object-contain opacity-90"
          />
          <div className="w-full text-right space-y-2">
            {timeToNextBreak != null && (
              <p className="text-[12px] md:text-[14px] font-700 leading-snug text-white/80">
                Перерыв через:{' '}
                <span className="tabular-nums font-black text-white">{formatEta(timeToNextBreak)}</span>
              </p>
            )}
            {lateRegClosed ? (
              <p className="text-[12px] md:text-[14px] font-bold text-red-500">Регистрация закрыта</p>
            ) : timeToLateRegEnd != null ? (
              <p className="text-[12px] md:text-[14px] font-700 leading-snug text-white/80">
                Поздняя регистрация: до{' '}
                <span className="tabular-nums font-black text-white">{formatEta(timeToLateRegEnd)}</span>
              </p>
            ) : null}
          </div>
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
