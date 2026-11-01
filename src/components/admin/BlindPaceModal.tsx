import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { isBreakLevel, type BlindLevel } from '../../data/blindStructures';
import {
  formatFinishShift,
  remainingAfterDurationChange,
  suggestLevelMinutes,
} from '../../lib/finishForecast';
import { formatClockMinutes } from '../../lib/playedClock';

function blindsLabel(level: BlindLevel): string {
  if (isBreakLevel(level)) return level.isLateRegEnd ? 'Конец реги' : 'Перерыв';
  return `${level.smallBlind.toLocaleString('ru-RU')} / ${level.bigBlind.toLocaleString('ru-RU')}`;
}

export function BlindPaceModal({
  levels,
  currentIndex,
  forecastEnd,
  targetEnd,
  nowMinutes,
  onClose,
  onAccept,
}: {
  levels: BlindLevel[];
  currentIndex: number;
  forecastEnd: number;
  targetEnd: number;
  nowMinutes: number;
  onClose: () => void;
  onAccept: (levels: BlindLevel[]) => void;
}) {
  const [minutes, setMinutes] = useState(() => suggestLevelMinutes({
    levels,
    currentIndex,
    remainingForecastMinutes: Math.max(0, forecastEnd - nowMinutes),
    targetRemainingMinutes: Math.max(0, targetEnd - nowMinutes),
  }));
  const nextEnd = nowMinutes + remainingAfterDurationChange({
    levels,
    currentIndex,
    nextMinutes: minutes,
    remainingForecastMinutes: Math.max(0, forecastEnd - nowMinutes),
  });
  const rows = useMemo(() => levels.map((level, index) => {
    const breakRow = isBreakLevel(level);
    const bogus = !breakRow && level.durationMinutes >= 90;
    return {
      index,
      label: breakRow ? blindsLabel(level) : `Уровень ${level.level || index + 1}`,
      blinds: breakRow ? '' : blindsLabel(level),
      editable: index > currentIndex && !breakRow && !bogus,
    };
  }), [currentIndex, levels]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(8,6,5,0.72)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Длительность уровней"
        className="flex max-h-[86vh] w-full max-w-lg flex-col rounded-2xl"
        style={{ background: '#1A1411', border: '1px solid rgba(242,216,167,0.28)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4">
          <div>
            <h2 className="text-[15px] font-800 text-white">Длительность уровней</h2>
            <p className="mt-1 text-[13px] font-700" style={{ color: '#F2D8A7' }}>
              {formatFinishShift(forecastEnd, nextEnd)}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: '#8c8c88' }}>
              Сейчас {formatClockMinutes(forecastEnd)} · обычный финиш {formatClockMinutes(targetEnd)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)' }}
            aria-label="Закрыть"
          >
            <X size={15} className="text-[#A39B98]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 px-1 pb-2 text-[10px] font-700 uppercase tracking-[0.12em]" style={{ color: '#8c8c88' }}>
            <span>Уровень</span>
            <span className="text-right">Сейчас</span>
            <span className="text-right">Новые</span>
          </div>
          <div className="space-y-1.5">
            {rows.map((row) => {
              const level = levels[row.index];
              const value = minutes[row.index] ?? level?.durationMinutes ?? 0;
              return (
                <div
                  key={row.index}
                  className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 rounded-xl px-2 py-2"
                  style={{ background: row.index === currentIndex ? 'rgba(217,153,98,0.16)' : '#2A211D' }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-700 text-white">{row.label}</p>
                    {row.blinds ? (
                      <p className="truncate text-[11px]" style={{ color: '#A39B98' }}>{row.blinds}</p>
                    ) : null}
                  </div>
                  <p className="text-right text-[13px] font-700 tabular-nums text-white/70">
                    {level?.durationMinutes ?? 0}
                  </p>
                  {row.editable ? (
                    <input
                      inputMode="numeric"
                      value={String(value)}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/[^\d]/g, '');
                        if (!digits) return;
                        const next = Math.min(60, Math.max(1, Math.round(Number(digits))));
                        setMinutes((prev) => prev.map((item, index) => (index === row.index ? next : item)));
                      }}
                      className="h-8 rounded-lg px-1 text-right text-[13px] font-800 text-white outline-none tabular-nums"
                      style={{ background: '#231A16', border: '1px solid rgba(217,153,98,0.35)' }}
                      aria-label={`Новая длительность: ${row.label}`}
                    />
                  ) : (
                    <p className="text-right text-[13px] font-700 tabular-nums" style={{ color: '#8c8c88' }}>{value}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => onAccept(levels.map((level, index) => ({
              ...level,
              durationMinutes: minutes[index] ?? level.durationMinutes,
            })))}
            className="w-full py-3 rounded-xl text-[14px] font-800 text-[#0A0908] active:scale-[0.98]"
            style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
          >
            Принять длительности
          </button>
        </div>
      </div>
    </div>
  );
}
