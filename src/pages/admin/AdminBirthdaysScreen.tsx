import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CompactHeader } from '../../components/CompactHeader';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import {
  ageTurning,
  birthdaysInMonth,
  formatBirthday,
  MONTH_NAMES,
  MONTH_OF,
  monthGrid,
  WEEKDAY_LABELS,
} from '../../lib/birthdays';
import type { MappedUser } from '../../lib/userApi';

function yearsLabel(age: number): string {
  const tail = age % 100;
  if (tail >= 11 && tail <= 14) return `${age} лет`;
  const last = age % 10;
  if (last === 1) return `${age} год`;
  if (last >= 2 && last <= 4) return `${age} года`;
  return `${age} лет`;
}

export function AdminBirthdaysScreen({
  users,
  onBack,
}: {
  users: MappedUser[];
  onBack: () => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [day, setDay] = useState<number | null>(null);

  const entries = useMemo(() => birthdaysInMonth(users, month), [users, month]);
  const byDay = useMemo(() => {
    const map = new Map<number, number>();
    for (const entry of entries) {
      map.set(entry.birthday.day, (map.get(entry.birthday.day) ?? 0) + 1);
    }
    return map;
  }, [entries]);
  const weeks = useMemo(() => monthGrid(year, month), [year, month]);
  const shown = day === null ? entries : entries.filter((entry) => entry.birthday.day === day);

  const step = (delta: number) => {
    const next = month + delta;
    setDay(null);
    if (next < 1) {
      setMonth(12);
      setYear((value) => value - 1);
      return;
    }
    if (next > 12) {
      setMonth(1);
      setYear((value) => value + 1);
      return;
    }
    setMonth(next);
  };

  const isToday = (cell: number) =>
    cell === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <CompactHeader title="Дни рождения" onBack={onBack} />

      <div
        className="flex-1 scrollable px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        <div
          className="rounded-2xl px-3 py-3"
          style={{ background: '#231A16', border: '1px solid rgba(217,153,98,0.22)' }}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => step(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft size={18} strokeWidth={2.4} style={{ color: '#D99962' }} />
            </button>
            <p className="text-[14px] font-800 uppercase tracking-[0.14em] text-white">
              {MONTH_NAMES[month - 1]} {year}
            </p>
            <button
              type="button"
              onClick={() => step(1)}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              aria-label="Следующий месяц"
            >
              <ChevronRight size={18} strokeWidth={2.4} style={{ color: '#D99962' }} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mt-3">
            {WEEKDAY_LABELS.map((label) => (
              <p
                key={label}
                className="text-center text-[10px] font-700 uppercase tracking-wide"
                style={{ color: '#6B6360' }}
              >
                {label}
              </p>
            ))}
          </div>

          <div className="mt-1 space-y-1">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-1">
                {week.map((cell, cellIndex) => {
                  if (cell === null) return <span key={cellIndex} className="h-10" />;
                  const count = byDay.get(cell) ?? 0;
                  const selected = day === cell;
                  return (
                    <button
                      key={cellIndex}
                      type="button"
                      onClick={() => setDay(selected ? null : cell)}
                      aria-pressed={selected}
                      aria-label={`${cell} ${MONTH_OF[month - 1]}${count > 0 ? `, дней рождения: ${count}` : ''}`}
                      className={`h-10 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[13px] font-700 transition-colors ${
                        selected
                          ? 'bg-[#D99962] text-[#0A0908]'
                          : count > 0
                            ? 'bg-[#D99962]/15 text-[#F2D8A7]'
                            : 'text-white/45'
                      }`}
                      style={
                        isToday(cell) && !selected
                          ? { border: '1px solid rgba(217,153,98,0.55)' }
                          : undefined
                      }
                    >
                      {cell}
                      <span
                        className={`h-1 w-1 rounded-full ${
                          count > 0 ? (selected ? 'bg-[#0A0908]' : 'bg-[#D99962]') : 'bg-transparent'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-3 mt-4 mb-2 px-1">
          <p className="text-[11px] font-700 uppercase tracking-[0.16em]" style={{ color: '#8c8c88' }}>
            {day === null
              ? `${MONTH_NAMES[month - 1]}: ${entries.length}`
              : `${day} ${MONTH_OF[month - 1]}: ${shown.length}`}
          </p>
          {day !== null && (
            <button
              type="button"
              onClick={() => setDay(null)}
              className="text-[12px] font-700 underline"
              style={{ color: '#D99962' }}
            >
              Весь месяц
            </button>
          )}
        </div>

        {shown.length === 0 ? (
          <p className="text-center text-[13px] py-8" style={{ color: '#6B6360' }}>
            {day === null
              ? 'В этом месяце дней рождения нет'
              : 'В этот день дней рождения нет'}
          </p>
        ) : (
          <div className="space-y-2">
            {shown.map(({ person, birthday }) => {
              const age = ageTurning(birthday, year);
              return (
                <div
                  key={person.id}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3"
                  style={{ background: '#231A16', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <PlayerAvatar
                    playerId={person.id}
                    nickname={person.nickname}
                    src={person.equippedAvatar}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-700 text-[15px] truncate">{person.nickname}</p>
                    <p className="text-[12px] font-600" style={{ color: '#D99962' }}>
                      {formatBirthday(birthday)}
                      {age !== null ? ` · ${yearsLabel(age)}` : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
