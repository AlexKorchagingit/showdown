import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Pause, Play, RotateCcw, Settings } from 'lucide-react';
import { BLIND_STRUCTURES, findBlindStructure, formatBlinds } from '../../data/blindStructures';

const SETTINGS_ROUTE = '/admin/blinds/settings';

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="bg-white/10 hover:bg-white/20 p-4 rounded-full transition-colors active:scale-95"
    >
      {children}
    </button>
  );
}

export function AdminBlindsTimer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const structure =
    findBlindStructure(searchParams.get('structure')) ?? BLIND_STRUCTURES[0];
  const levelSeconds = structure.levelDuration * 60;

  const [levelIndex, setLevelIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(levelSeconds);
  const [isRunning, setIsRunning] = useState(false);

  const lastTickRef = useRef<number | null>(null);

  // Reset whenever a different structure is opened
  useEffect(() => {
    setLevelIndex(0);
    setSecondsLeft(structure.levelDuration * 60);
    setIsRunning(false);
  }, [structure.id, structure.levelDuration]);

  useEffect(() => {
    if (!isRunning) {
      lastTickRef.current = null;
      return;
    }

    // Wall-clock deltas keep the countdown honest if the tab is throttled
    const id = window.setInterval(() => {
      const now = Date.now();
      const elapsed = (now - (lastTickRef.current ?? now)) / 1000;
      lastTickRef.current = now;

      setSecondsLeft((prev) => {
        const next = prev - elapsed;
        if (next > 0) return next;

        let carried = next;
        setLevelIndex((index) => {
          if (index >= structure.levels.length - 1) {
            carried = 0;
            setIsRunning(false);
            return index;
          }
          carried = next + levelSeconds;
          return index + 1;
        });
        return carried;
      });
    }, 250);

    return () => window.clearInterval(id);
  }, [isRunning, levelSeconds, structure.levels.length]);

  const restartLevel = useCallback(() => {
    setSecondsLeft(levelSeconds);
    setIsRunning(false);
  }, [levelSeconds]);

  const currentLevel = structure.levels[levelIndex];
  const nextLevel = structure.levels[levelIndex + 1];
  const progress = Math.min(100, Math.max(0, ((levelSeconds - secondsLeft) / levelSeconds) * 100));

  return (
    // Escapes the 480px phone column so the timer can use the whole screen
    <div className="fixed inset-0 z-[100] bg-[#0A0908]">
      <div className="flex flex-col md:flex-row w-full h-full text-white">
        {/* Prize pool */}
        <div className="w-full md:w-1/4 bg-[#110b09]/50 p-6 border-b md:border-b-0 md:border-r border-white/10">
          <h2
            className="text-[12px] font-800 uppercase tracking-[0.2em] mb-4"
            style={{ color: '#D99962' }}
          >
            Гарантия очков
          </h2>

          <p className="text-2xl font-black mb-5" style={{ color: '#F2D8A7' }}>
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

        {/* Timer */}
        <div className="flex-1 flex flex-col items-center justify-center relative p-6 min-h-0">
          <p
            className="text-[13px] font-800 uppercase tracking-[0.35em]"
            style={{ color: '#D99962' }}
          >
            Showdown
          </p>
          <h1 className="text-xl md:text-3xl font-black uppercase tracking-wide text-center mt-1">
            {structure.name}
          </h1>

          <p className="text-[13px] font-700 uppercase tracking-[0.2em] mt-6" style={{ color: '#D99962' }}>
            Level {levelIndex + 1}
          </p>
          <p className="text-lg md:text-2xl font-bold text-white mt-1">
            {formatBlinds(currentLevel)}
          </p>

          <p className="text-[20vw] md:text-[10rem] font-black leading-none tabular-nums my-2">
            {formatClock(secondsLeft)}
          </p>

          <div className="w-3/4 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-linear"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(to right, #8C4C27, #D99962)',
              }}
            />
          </div>

          <p className="text-[13px] font-500 text-white/40 mt-6">
            Next Blinds: {nextLevel ? formatBlinds(nextLevel) : 'финальный уровень'}
          </p>

          <div className="absolute bottom-6 right-6 flex gap-4">
            <ControlButton
              label={isRunning ? 'Пауза' : 'Запустить'}
              onClick={() => setIsRunning((v) => !v)}
            >
              {isRunning ? (
                <Pause size={22} strokeWidth={2.2} fill="currentColor" />
              ) : (
                <Play size={22} strokeWidth={2.2} fill="currentColor" />
              )}
            </ControlButton>

            <ControlButton label="Заново" onClick={restartLevel}>
              <RotateCcw size={22} strokeWidth={2.2} />
            </ControlButton>

            <ControlButton label="Настройки" onClick={() => navigate(SETTINGS_ROUTE)}>
              <Settings size={22} strokeWidth={2.2} />
            </ControlButton>
          </div>
        </div>
      </div>
    </div>
  );
}
