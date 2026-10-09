import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Settings, X } from 'lucide-react';
import { cashierPlayers } from '../../lib/tournamentArrival';
import {
  drawRandomPlayers,
  eligibleDrawPlayers,
  readDrawSettings,
  writeDrawSettings,
  type DrawPlayer,
} from '../../lib/timerDraw';
import type { Tournament } from '../../types/tournament';

type Spark = { id: number; dx: number; dy: number; delay: number; color: string };

function burst(): Spark[] {
  return Array.from({ length: 16 }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    return {
      id: index,
      dx: side * (64 + Math.random() * 96),
      dy: (Math.random() - 0.5) * 72,
      delay: Math.random() * 0.08,
      color: ['#F2D8A7', '#D99962', '#FFFFFF'][index % 3]!,
    };
  });
}

function cashierDrawPlayers(tournament: Tournament | undefined): DrawPlayer[] {
  if (!tournament) return [];
  return cashierPlayers(tournament.participants).map((player) => ({
    id: player.id,
    nickname: player.nickname,
  }));
}

export function TimerDrawModal({
  tournament,
  onClose,
}: {
  tournament: Tournament | undefined;
  onClose: () => void;
}) {
  const players = useMemo(() => cashierDrawPlayers(tournament), [tournament]);
  const [count, setCount] = useState(1);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [drawn, setDrawn] = useState<DrawPlayer[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);

  useEffect(() => {
    const saved = tournament ? readDrawSettings(tournament.id) : { count: 1, excluded: [] };
    setCount(saved.count);
    setExcluded(saved.excluded);
    setFlipped(false);
    setDrawn([]);
    setSettingsOpen(false);
  }, [tournament?.id]);

  const persist = (nextCount: number, nextExcluded: string[]) => {
    setCount(nextCount);
    setExcluded(nextExcluded);
    if (tournament) writeDrawSettings(tournament.id, { count: nextCount, excluded: nextExcluded });
  };

  const eligible = eligibleDrawPlayers(players, excluded);
  const maxCount = Math.max(1, eligible.length);

  const flip = () => {
    if (flipped) {
      setFlipped(false);
      return;
    }
    const next = drawRandomPlayers(players, excluded, count);
    if (next.length === 0) return;
    setDrawn(next);
    setSparks(burst());
    setFlipped(true);
  };

  const toggle = (id: string) => {
    const next = excluded.includes(id) ? excluded.filter((row) => row !== id) : [...excluded, id];
    const left = eligibleDrawPlayers(players, next).length;
    persist(Math.min(count, Math.max(1, left)), next);
  };

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-[380px] rounded-3xl px-4 pt-4 pb-5"
        style={{
          background: '#1A1411',
          border: '1px solid rgba(217,153,98,0.35)',
          boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-[14px] font-800 uppercase tracking-[0.14em] text-white">
            {settingsOpen ? 'Кого выбирать' : 'Случайный игрок'}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{
                background: settingsOpen ? 'rgba(217,153,98,0.28)' : 'rgba(255,255,255,0.06)',
              }}
              aria-label="Настройки выбора"
              aria-pressed={settingsOpen}
            >
              <Settings size={16} strokeWidth={2.2} style={{ color: '#D99962' }} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              aria-label="Закрыть"
            >
              <X size={16} style={{ color: '#A39B98' }} />
            </button>
          </div>
        </div>

        {settingsOpen ? (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[13px] font-700 text-white">Сколько человек</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => persist(Math.max(1, count - 1), excluded)}
                  disabled={count <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                  aria-label="Меньше"
                >
                  <Minus size={14} style={{ color: '#D99962' }} />
                </button>
                <span className="w-6 text-center text-[16px] font-900 text-white">{count}</span>
                <button
                  type="button"
                  onClick={() => persist(Math.min(maxCount, count + 1), excluded)}
                  disabled={count >= maxCount}
                  className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                  aria-label="Больше"
                >
                  <Plus size={14} style={{ color: '#D99962' }} />
                </button>
              </div>
            </div>
            <p className="mb-2 text-[11px] font-600" style={{ color: '#8c8c88' }}>
              Снимите галку, чтобы убрать человека из выбора. В кассе: {players.length}, в выборе:{' '}
              {eligible.length}.
            </p>
            {players.length === 0 ? (
              <p className="py-6 text-center text-[13px]" style={{ color: '#6B6360' }}>
                В кассе пока никого
              </p>
            ) : (
              <div className="space-y-1.5">
                {players.map((player) => {
                  const included = !excluded.includes(player.id);
                  return (
                    <label
                      key={player.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5"
                      style={{ background: '#231A16' }}
                    >
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={() => toggle(player.id)}
                        className="h-4 w-4 accent-[#D99962]"
                      />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-700 text-white">
                        {player.nickname.trim() || player.id}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="draw-scene relative h-[250px] w-[190px]">
              {sparks.map((spark) => (
                <span
                  key={`${spark.id}-${drawn.map((row) => row.id).join('-')}`}
                  className="draw-spark"
                  style={{
                    background: spark.color,
                    animationDelay: `${spark.delay}s`,
                    ['--dx' as string]: `${spark.dx}px`,
                    ['--dy' as string]: `${spark.dy}px`,
                  }}
                />
              ))}
              <button
                type="button"
                onClick={flip}
                disabled={eligible.length === 0}
                aria-label={flipped ? 'Перевернуть карточку обратно' : 'Выбрать случайного игрока'}
                className={`draw-card h-full w-full disabled:opacity-60 ${flipped ? 'is-flipped' : ''}`}
              >
                <span
                  className="draw-face absolute inset-0 flex items-center justify-center rounded-2xl"
                  style={{
                    background: 'linear-gradient(160deg, #2A1C16, #120d0b)',
                    border: '1px solid rgba(217,153,98,0.55)',
                    boxShadow: '0 0 24px rgba(217,153,98,0.18)',
                  }}
                >
                  <span className="text-[92px] font-900 leading-none text-[#D99962]">?</span>
                </span>
                <span
                  className="draw-face draw-face-back absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl px-3 text-center"
                  style={{
                    background: 'linear-gradient(160deg, #F2D8A7, #D99962 55%, #8C4C27)',
                    border: '1px solid rgba(242,216,167,0.8)',
                  }}
                >
                  {drawn.map((player) => (
                    <span
                      key={player.id}
                      className="max-w-full truncate font-900 leading-tight text-[#0A0908]"
                      style={{ fontSize: drawn.length > 3 ? 18 : drawn.length > 1 ? 22 : 28 }}
                    >
                      {player.nickname}
                    </span>
                  ))}
                </span>
              </button>
            </div>
            <p className="mt-3 text-center text-[12px] font-600" style={{ color: '#A39B98' }}>
              {eligible.length === 0
                ? 'В кассе некого выбирать'
                : flipped
                  ? 'Нажмите ещё раз, чтобы выбрать заново'
                  : `Нажмите на карточку · ${Math.min(count, eligible.length)} из ${eligible.length}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
