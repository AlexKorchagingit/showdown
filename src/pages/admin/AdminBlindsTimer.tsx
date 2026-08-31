import { useEffect, useMemo, useState } from 'react';
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
import { ScreenLoading } from '../../components/ScreenLoading';
import { TimerSessionFields } from '../../components/TimerSessionFields';
import { FitText } from '../../components/FitText';
import { useBlinds } from '../../context/BlindsContext';
import { useProfile } from '../../context/ProfileContext';
import { useTournaments } from '../../context/TournamentContext';
import { useBindPokerTimer } from '../../hooks/useBindPokerTimer';
import { resolveStructureForTournament } from '../../lib/timerTournament';
import {
  breakComment,
  formatBlinds,
  formatEta,
  isBreakLevel,
  isLateRegClosed,
  secondsUntilLateRegEnd,
  secondsUntilNextBreak,
  upcomingBreakLevel,
} from '../../data/blindStructures';
import { calculatePayouts, itmSharePercent } from '../../data/prizeStructure';
import { isAppFullscreen, toggleAppFullscreen } from '../../lib/fullscreen';
import { asset } from '../../lib/assets';
import { characterImageForPlayer } from '../../lib/playerCharacter';
import {
  autoAvgStack,
  nicknamesByPlace,
  remainingPlayers,
  tournamentPlayerCounts,
} from '../../lib/tournamentStats';

const SETTINGS_ROUTE = '/admin/blinds/settings';
const CIRCLE_SIZE = 420;
const STROKE = 10;
const RADIUS = 194;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GLASS =
  'bg-white/[0.03] border border-white/[0.05] rounded-2xl p-5 backdrop-blur-sm';

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
      className="relative z-10 pointer-events-auto bg-white/5 hover:bg-white/20 text-white/80 hover:text-[#D99962] p-4 rounded-full transition-colors active:scale-95 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-white/80"
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
    timerReady,
    structures,
    activeStructure,
    activeStructureId,
    levelIndex,
    secondsLeft,
    levelDurationSeconds,
    isRunning,
    ensureTimer,
    setRunning,
    restartLevel,
    skipLevel,
    adjustSeconds,
    linkedTournamentId,
    avgStackOverride,
    chipleaderId,
    setChipleader,
    totalEntries,
    rebuyCount,
    chipleaderStack,
  } = useBlinds();

  const { bindTournament } = useBindPokerTimer();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(isAppFullscreen);

  const tournamentIdParam = searchParams.get('tournament');
  const structureIdParam = searchParams.get('structure');
  const boundTournament = (() => {
    const id = tournamentIdParam ?? linkedTournamentId;
    if (!id) return undefined;
    const found = tournaments.find((row) => row.id === id);
    if (!found) return undefined;
    if (tournamentIdParam) return found;
    if (structureIdParam) {
      const usesThisLadder =
        resolveStructureForTournament(found, structures)?.id === structureIdParam;
      return usesThisLadder ? found : undefined;
    }
    return found;
  })();
  const resolvedStructure =
    resolveStructureForTournament(boundTournament, structures) ??
    structures.find((row) => row.id === (structureIdParam ?? activeStructure?.id ?? '')) ??
    activeStructure;

  useEffect(() => {
    if (!timerReady) return;
    if (tournamentIdParam) {
      bindTournament(tournamentIdParam);
      return;
    }
    if (structureIdParam) {
      ensureTimer(structureIdParam);
      if (isRunning) return;
      const linked = tournaments.find((row) => row.id === linkedTournamentId);
      const usesThisLadder =
        resolveStructureForTournament(linked, structures)?.id === structureIdParam;
      if (linkedTournamentId && !usesThisLadder) bindTournament(null);
    }
  }, [
    timerReady,
    tournamentIdParam,
    structureIdParam,
    bindTournament,
    ensureTimer,
    tournaments,
    linkedTournamentId,
    structures,
    isRunning,
  ]);

  useEffect(() => {
    const sync = () => setFullscreen(isAppFullscreen());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const structure = resolvedStructure;
  const tournament = boundTournament;
  const { remaining } = tournamentPlayerCounts(tournament);
  const avgStack = avgStackOverride ?? autoAvgStack(tournament);
  const seated = remainingPlayers(tournament);
  const chipleader = seated.find((p) => p.id === chipleaderId) ?? null;
  const eventTitle = tournament?.title ?? structure?.name ?? '';

  const timeToNextBreak = useMemo(
    () =>
      structure
        ? secondsUntilNextBreak(structure.levels, levelIndex, secondsLeft)
        : null,
    [structure, levelIndex, secondsLeft],
  );
  const nextBreakNote = useMemo(
    () => (structure ? breakComment(upcomingBreakLevel(structure.levels, levelIndex)) : ''),
    [structure, levelIndex],
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
  const hasField = Boolean(tournament && tournament.participants.length > 0);
  const activePlayersCount = hasField ? remaining : Number.POSITIVE_INFINITY;
  const eliminatedNickByPlace = useMemo(() => nicknamesByPlace(tournament), [tournament]);

  useEffect(() => {
    if (!chipleaderId || !tournament) return;
    if (tournament.participants.length === 0) return;
    const stillSeated = tournament.participants.some(
      (p) => p.id === chipleaderId && typeof p.place !== 'number',
    );
    if (!stillSeated) setChipleader(null);
  }, [chipleaderId, tournament, setChipleader]);

  if (!timerReady) {
    return (
      <div className="relative h-full w-full min-h-0 overflow-hidden text-white bg-[#0A0908]">
        <ScreenLoading label="Загрузка таймера…" />
      </div>
    );
  }

  if (!structure && !activeStructureId) return <Navigate to={SETTINGS_ROUTE} replace />;

  const currentLevel = structure?.levels[levelIndex];
  const nextLevel = structure?.levels[levelIndex + 1];
  const levelSeconds = Math.max(1, levelDurationSeconds);
  const percent = Math.min(100, Math.max(0, (secondsLeft / Math.max(1, levelSeconds)) * 100));
  const dashOffset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
  const isBreak = isBreakLevel(currentLevel);
  const currentBreakNote = breakComment(currentLevel);
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
    <div className="relative h-full w-full min-h-0 overflow-hidden text-white bg-[#0A0908]">
      <div className="relative flex h-full w-full min-h-0 items-stretch gap-4 overflow-visible p-6 md:p-8 pb-28">
        <div className="w-[240px] md:w-[280px] shrink-0 flex flex-col min-h-0">
          <section className={`${GLASS} flex-1 min-h-0 overflow-y-auto`}>
            <p className="text-sm md:text-lg font-800 uppercase tracking-[0.16em] text-[#D99962]">
              Гарантия очков
            </p>
            <p className="text-4xl md:text-5xl font-black mt-3 leading-none tabular-nums text-[#F2D8A7]">
              {prizePool.toLocaleString('ru-RU')}
            </p>

            <div className="mt-5 tabular-nums">
              {hasEntries ? (
                <>
                  <p className="text-xs font-700 uppercase tracking-[0.14em] text-white/40 mb-3">
                    В призах: {payouts.length} чел. ({itmSharePercent()}%)
                  </p>
                  {payouts.length === 0 ? (
                    <p className="text-sm font-600 text-white/40">Нет призовых мест</p>
                  ) : (
                    <div className="space-y-2.5">
                      {payouts.map(({ place, points }) => {
                        const awarded = place > activePlayersCount;
                        const nickname = awarded ? eliminatedNickByPlace.get(place) : undefined;
                        const label = nickname ?? `${place} место`;
                        return (
                          <div
                            key={place}
                            className={`flex justify-between items-baseline gap-3 rounded-lg px-2 py-1 -mx-2 ${
                              awarded ? 'opacity-50 text-[#A39B98] bg-black/20' : ''
                            }`}
                          >
                            <span
                              className={`text-lg md:text-xl font-700 truncate ${
                                awarded ? '' : 'text-white/70'
                              }`}
                            >
                              {label}
                            </span>
                            <span
                              className={`text-base md:text-lg font-black tabular-nums shrink-0 ${
                                awarded ? '' : 'text-[#D99962]'
                              }`}
                            >
                              {points.toLocaleString('ru-RU')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xl font-medium text-white/70">Идет подсчет распределения очков...</p>
              )}
            </div>
          </section>
        </div>

        <div className="flex w-[220px] min-h-0 min-w-0 shrink-0 flex-col gap-4 overflow-visible md:w-[260px]">
          {hasEntries && (
            <section className={`${GLASS} text-center min-w-0`}>
              <p className="text-sm md:text-base font-800 uppercase tracking-[0.18em] text-white/40">
                В ИГРЕ
              </p>
              <FitText className="text-white mt-2">
                {remaining}
                <span className="text-white/35"> / {totalEntries}</span>
              </FitText>
              {rebuyCount != null && rebuyCount > 0 && (
                <p className="text-sm md:text-base font-600 text-white/60 mt-2">Ребаев: {rebuyCount}</p>
              )}
            </section>
          )}

          <section className={`${GLASS} text-center min-w-0`}>
            <p className="text-sm md:text-base font-800 uppercase tracking-[0.18em] text-white/40">
              СРЕДНИЙ СТЕК
            </p>
            <FitText className="mt-2 text-[#F2D8A7]">
              {avgStack.toLocaleString('ru-RU')}
            </FitText>
          </section>

          {chipleader && (
            <div className="relative z-[1] mt-auto w-full min-w-0 shrink-0">
              <img
                src={characterImageForPlayer(chipleader.id, chipleader.nickname, equippedChar)}
                alt=""
                className="pointer-events-none absolute bottom-[calc(100%-12px)] left-1/2 z-20 h-[320px] w-auto max-w-none -translate-x-1/2 object-contain object-bottom"
              />
              <section className="relative z-10 w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.03] px-4 pb-3 pt-2 text-center backdrop-blur-sm">
                <p className="text-[11px] font-800 uppercase tracking-[0.28em] text-[#D99962] md:text-xs">
                  CHIPLEADER
                </p>
                <p className="mt-0.5 w-full truncate px-1 text-center text-lg font-black leading-tight text-white md:text-xl">
                  {chipleader.nickname}
                </p>
                <FitText maxPx={32} className="text-[#D99962]">
                  {chipleaderStack != null ? chipleaderStack.toLocaleString('ru-RU') : '—'}
                </FitText>
              </section>
            </div>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center px-1 pt-0">
          <p className="mt-1 inline-block bg-gradient-to-r from-[#8C4C27] via-[#F2D8A7] to-[#D99962] bg-[length:200%_auto] bg-clip-text text-xl font-800 uppercase tracking-widest text-transparent animate-gradient md:text-2xl">
            SHOWDOWN
          </p>
          <h1 className="mt-1 text-center text-2xl font-black uppercase leading-tight tracking-wide text-[#D99962] md:text-3xl">
            {eventTitle}
          </h1>

          <div
            className="relative mt-2 flex min-h-0 w-full flex-1 items-center justify-center"
            style={{ containerType: 'size' }}
          >
            <div className="relative aspect-square w-[min(100%,100cqh,38rem)] max-h-full">
              <svg
                viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}
                className="pointer-events-none h-full w-full -rotate-90"
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
                  className="transition-all duration-1000 linear"
                />
              </svg>
              {/* Clip to the inner ring so type can be large without leaving the circle. */}
              <div
                className="pointer-events-none absolute inset-[5%] overflow-hidden rounded-full px-4 text-center"
                style={{ containerType: 'inline-size' }}
              >
                <div className="flex h-full w-full origin-center scale-95 flex-col items-center justify-center">
                  {isBreak ? (
                    <>
                      <p className="text-[clamp(1.5rem,18cqi,3.25rem)] font-black uppercase leading-none tracking-[0.12em] text-white">
                        ПЕРЕРЫВ
                      </p>
                      {currentBreakNote ? (
                        <p className="mt-2 max-w-full px-1 text-[clamp(0.95rem,8cqi,1.85rem)] font-800 leading-snug text-[#F2D8A7]">
                          {currentBreakNote}
                        </p>
                      ) : null}
                      <p className="mt-2 text-[clamp(3rem,42cqi,8rem)] font-black leading-none tabular-nums drop-shadow-[0_0_20px_rgba(217,153,98,0.5)]">
                        {formatClock(secondsLeft)}
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="rounded-full bg-[#D99962]/20 px-5 py-1 text-[clamp(1.05rem,11cqi,2rem)] font-bold uppercase tracking-widest text-[#D99962]">
                        {levelBadge}
                      </span>
                      <p className="mt-2 max-w-full px-0.5 text-[clamp(1.85rem,26cqi,5.5rem)] font-black leading-[1.05] text-white">
                        {blindsLabel}
                      </p>
                      <p className="mt-1.5 text-[clamp(1.2rem,14cqi,2.75rem)] font-700 text-[#F2D8A7]">
                        {anteLabel}
                      </p>
                      <p className="mt-1.5 text-[clamp(3rem,42cqi,8rem)] font-black leading-none tabular-nums drop-shadow-[0_0_20px_rgba(217,153,98,0.5)]">
                        {formatClock(secondsLeft)}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="absolute left-0 top-0 z-[1] h-full w-1/2 cursor-pointer bg-transparent"
                aria-label="Минус одна минута"
                onClick={() => adjustSeconds(-60)}
              />
              <button
                type="button"
                className="absolute right-0 top-0 z-[1] h-full w-1/2 cursor-pointer bg-transparent"
                aria-label="Плюс одна минута"
                onClick={() => adjustSeconds(60)}
              />
            </div>
          </div>

          <p className="mt-2.5 mb-1.5 shrink-0 text-center text-[1.24rem] font-bold leading-snug text-white/70 md:text-[1.38rem]">
            Next Blinds:{' '}
            <span className="text-[#D99962]">
              {nextLevel ? formatBlinds(nextLevel) : 'финальный уровень'}
            </span>
          </p>
        </div>

        <div className="w-64 md:w-80 shrink-0 flex flex-col items-end gap-4">
          <img
            src={asset('/SD.png')}
            alt="Showdown"
            className="h-40 md:h-56 w-auto object-contain opacity-90 self-end"
          />
          <section className={`${GLASS} w-full self-end text-right space-y-4`}>
            {timeToNextBreak != null && (
              <div>
                <p className="text-base md:text-lg font-800 uppercase tracking-[0.08em] text-white/55">
                  Перерыв через
                </p>
                <p className="text-xl md:text-2xl font-black tabular-nums text-white mt-1">
                  {formatEta(timeToNextBreak)}
                </p>
                {nextBreakNote ? (
                  <p className="mt-1 text-base md:text-lg font-700 leading-snug text-[#F2D8A7]">
                    {nextBreakNote}
                  </p>
                ) : null}
              </div>
            )}
            {lateRegClosed ? (
              <p className="text-lg font-bold text-red-500">Регистрация закрыта</p>
            ) : timeToLateRegEnd != null ? (
              <div>
                <p className="text-base md:text-lg font-800 uppercase tracking-[0.08em] text-white/55">
                  Поздняя регистрация
                </p>
                <p className="text-xl md:text-2xl font-black tabular-nums text-white mt-1">
                  {formatEta(timeToLateRegEnd)}
                </p>
              </div>
            ) : null}
            {timeToNextBreak == null && !lateRegClosed && timeToLateRegEnd == null && (
              <p className="text-xl text-white/35">Тайминги не заданы</p>
            )}
          </section>
        </div>
      </div>

      <div className="absolute bottom-8 right-8 z-50 flex items-center gap-2 pointer-events-auto">
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
          disabled={levelIndex >= (structure?.levels.length ?? 1) - 1}
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

      {settingsOpen && (
        <div className="absolute inset-0 z-[60] flex items-end justify-center">
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
            <TimerSessionFields />
          </div>
        </div>
      )}
    </div>
  );
}
