import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Minus, Plus, Settings, X } from 'lucide-react';
import { cashierPlayers } from '../../lib/tournamentArrival';
import { sortFinancePlayers } from '../../lib/tournamentStatus';
import {
  drawRandomPlayers,
  eligibleDrawPlayers,
  readDrawSettings,
  writeDrawSettings,
  type DrawPlayer,
} from '../../lib/timerDraw';
import type { Tournament } from '../../types/tournament';

type Seat = DrawPlayer & { place?: number };

type Spark = {
  id: number;
  /** Start point on the card edge, in percent of the card. */
  x: number;
  y: number;
  dx: number;
  dy: number;
  delay: number;
  color: string;
  size: number;
  rot: number;
  duration: number;
  streak: boolean;
};

const SPARK_COLORS = ['#F2D8A7', '#D99962', '#FFFFFF', '#FFB347', '#FFE7C2', '#E8C07A'];

/** A point on the card outline and the direction that leaves the card. */
function edgePoint(t: number): { x: number; y: number; nx: number; ny: number } {
  const width = 0.9;
  const height = 1;
  const span = 2 * (width + height);
  let distance = ((t % 1) + 1) % 1 * span;
  if (distance < width) return { x: (distance / width) * 100, y: 0, nx: 0, ny: -1 };
  distance -= width;
  if (distance < height) return { x: 100, y: (distance / height) * 100, nx: 1, ny: 0 };
  distance -= height;
  if (distance < width) return { x: (1 - distance / width) * 100, y: 100, nx: 0, ny: 1 };
  distance -= width;
  return { x: 0, y: (1 - distance / height) * 100, nx: -1, ny: 0 };
}

function burst(): Spark[] {
  const sparks: Spark[] = [];
  const push = (
    id: number,
    x: number,
    y: number,
    nx: number,
    ny: number,
    dist: number,
    delay: number,
    streak: boolean,
  ) => {
    const tangent = (Math.random() - 0.5) * 22;
    const dx = nx * dist - ny * tangent;
    const dy = ny * dist + nx * tangent;
    sparks.push({
      id,
      x,
      y,
      dx,
      dy,
      delay,
      color: SPARK_COLORS[id % SPARK_COLORS.length]!,
      size: streak ? 10 + Math.random() * 8 : 4 + Math.random() * 7,
      rot: (Math.atan2(dy, dx) * 180) / Math.PI,
      duration: 0.7 + Math.random() * 0.5,
      streak,
    });
  };
  for (let index = 0; index < 36; index += 1) {
    const point = edgePoint(index / 36 + (Math.random() - 0.5) * 0.015);
    push(index, point.x, point.y, point.nx, point.ny, 42 + Math.random() * 74, Math.random() * 0.12, index % 4 === 0);
  }
  const corners = [
    { x: 0, y: 0, nx: -0.72, ny: -0.7 },
    { x: 100, y: 0, nx: 0.72, ny: -0.7 },
    { x: 0, y: 100, nx: -0.72, ny: 0.7 },
    { x: 100, y: 100, nx: 0.72, ny: 0.7 },
  ];
  corners.forEach((corner, cornerIndex) => {
    for (let index = 0; index < 4; index += 1) {
      push(
        100 + cornerIndex * 4 + index,
        corner.x,
        corner.y,
        corner.nx,
        corner.ny,
        56 + Math.random() * 70,
        0.14 + Math.random() * 0.2,
        index % 2 === 0,
      );
    }
  });
  return sparks;
}

function cashierDrawPlayers(tournament: Tournament | undefined): Seat[] {
  if (!tournament) return [];
  const field = cashierPlayers(tournament.participants).map((player) => ({
    id: player.id,
    nickname: player.nickname,
    place: player.place,
  }));
  return sortFinancePlayers(field, tournament.isClosed);
}

function nameSize(count: number): number {
  if (count <= 1) return 36;
  if (count === 2) return 28;
  if (count === 3) return 22;
  if (count <= 5) return 18;
  return 15;
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
  const [burstId, setBurstId] = useState(0);

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
    setBurstId((value) => value + 1);
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
        className="relative w-full max-w-[460px] rounded-3xl px-4 pt-4 pb-5"
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
              aria-label={settingsOpen ? 'Назад' : 'Настройки выбора'}
              aria-pressed={settingsOpen}
            >
              {settingsOpen ? (
                <ArrowLeft size={16} strokeWidth={2.2} style={{ color: '#D99962' }} />
              ) : (
                <Settings size={16} strokeWidth={2.2} style={{ color: '#D99962' }} />
              )}
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
                  const eliminated = typeof player.place === 'number';
                  return (
                    <label
                      key={player.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${eliminated ? 'opacity-50 grayscale' : ''}`}
                      style={{ background: '#231A16' }}
                    >
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={() => toggle(player.id)}
                        className="h-4 w-4 shrink-0 accent-[#D99962]"
                      />
                      <span className="min-w-0 flex-1 break-words text-[14px] font-700 leading-snug text-white">
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
            <div className="draw-scene relative h-[min(380px,58vh)] w-full max-w-[340px]">
              {sparks.length > 0 && (
                <span key={burstId} className="draw-fx">
                  <span className="draw-ring" />
                  <span className="draw-ring draw-ring-late" />
                  {sparks.map((spark) => (
                    <span
                      key={`${burstId}-${spark.id}`}
                      className={`draw-spark ${spark.streak ? 'is-streak' : ''}`}
                      style={{
                        background: spark.color,
                        color: spark.color,
                        width: spark.streak ? spark.size * 2.2 : spark.size,
                        height: spark.streak ? 3 : spark.size,
                        animationDelay: `${spark.delay}s`,
                        animationDuration: `${spark.duration}s`,
                        ['--x' as string]: `${spark.x}%`,
                        ['--y' as string]: `${spark.y}%`,
                        ['--dx' as string]: `${spark.dx}px`,
                        ['--dy' as string]: `${spark.dy}px`,
                        ['--rot' as string]: `${spark.rot}deg`,
                      }}
                    />
                  ))}
                </span>
              )}
              <button
                type="button"
                onClick={flip}
                disabled={eligible.length === 0}
                aria-label={flipped ? 'Перевернуть карточку обратно' : 'Выбрать случайного игрока'}
                className={`draw-card h-full w-full disabled:opacity-60 ${flipped ? 'is-flipped' : ''}`}
              >
                <span
                  className="draw-face absolute inset-0 flex items-center justify-center rounded-3xl"
                  style={{
                    background: 'linear-gradient(160deg, #2A1C16, #120d0b)',
                    border: '1px solid rgba(217,153,98,0.55)',
                    boxShadow: '0 0 28px rgba(217,153,98,0.22)',
                  }}
                >
                  <span className="text-[clamp(5.5rem,22vw,8rem)] font-900 leading-none text-[#D99962]">?</span>
                </span>
                <span
                  className="draw-face draw-face-back absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-y-auto rounded-3xl px-5 py-4 text-center"
                  style={{
                    background: 'linear-gradient(160deg, #F2D8A7, #D99962 55%, #8C4C27)',
                    border: '1px solid rgba(242,216,167,0.8)',
                  }}
                >
                  {drawn.map((player) => (
                    <span
                      key={player.id}
                      className="max-w-full break-words font-900 leading-tight text-[#0A0908] line-clamp-4"
                      style={{ fontSize: nameSize(drawn.length) }}
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
