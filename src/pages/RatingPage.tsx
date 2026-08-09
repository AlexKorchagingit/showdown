import { useState, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crosshair, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import type { RatingPlayer } from '../types/player';
import { MOCK_PLAYERS_GENERAL, MOCK_PLAYERS_SEASONAL } from '../types/player';

type RatingTab = 'general' | 'seasonal';
type MetricColumn = 'tournaments' | 'wins' | 'knockouts';

const MONTHS = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

const TOP3_GLOW: Record<number, string> = {
  1: '#D99962',
  2: '#8c8c88',
  3: '#8C4C27',
};

const rankTextColor = (rank: number): string => {
  if (rank === 1) return '#F2D8A7';
  if (rank === 2) return '#A39B98';
  if (rank === 3) return '#c8a38e';
  return '#ffffff';
};

function metricValue(player: RatingPlayer, column: MetricColumn): number {
  if (column === 'tournaments') return player.played;
  if (column === 'wins') return player.won;
  return player.knockouts;
}

function ColumnSelector({
  active,
  onChange,
}: {
  active: MetricColumn;
  onChange: (column: MetricColumn) => void;
}) {
  const options: { id: MetricColumn; label: ReactNode; aria: string }[] = [
    { id: 'tournaments', label: 'Турниры', aria: 'Турниры' },
    { id: 'wins', label: <Trophy size={14} strokeWidth={2.3} />, aria: 'Победы' },
    { id: 'knockouts', label: <Crosshair size={14} strokeWidth={2.3} />, aria: 'Нокауты' },
  ];

  return (
    <div
      className="flex items-center gap-2 p-1 rounded-xl"
      style={{ background: '#1E1612', border: '1px solid rgba(255,255,255,0.06)' }}
      role="tablist"
      aria-label="Показатель таблицы"
    >
      {options.map(({ id, label, aria }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-label={aria}
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={`h-8 px-3 rounded-lg text-[11px] font-700 transition-colors flex items-center justify-center ${
              isActive ? 'bg-[#D99962] text-[#110b09]' : 'text-[#8c8c88]'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function PlayerRow({
  player,
  rank,
  activeColumn,
}: {
  player: RatingPlayer;
  rank: number;
  activeColumn: MetricColumn;
}) {
  const isTop3 = rank <= 3;
  const glowColor = isTop3 ? TOP3_GLOW[rank] : null;

  return (
    <div className="relative">
      {isTop3 && (
        <div
          className="absolute inset-0 rounded-2xl animate-pulse pointer-events-none"
          style={{ boxShadow: `0 0 10px ${glowColor}` }}
        />
      )}

      <div
        className="relative z-10 flex items-center px-4 py-3 rounded-2xl"
        style={{
          background: isTop3 ? 'rgba(70,49,41,0.45)' : '#2A211D',
          border: isTop3
            ? `1px solid ${glowColor}50`
            : '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <span
          className="w-7 shrink-0 text-center font-800 leading-none"
          style={{ fontSize: 18, color: rankTextColor(rank) }}
        >
          {rank}
        </span>

        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-700 shrink-0"
          style={{
            background: isTop3 ? 'rgba(140,76,39,0.28)' : 'rgba(255,255,255,0.06)',
            color: isTop3 ? '#c8a38e' : '#A39B98',
          }}
        >
          {player.initial}
        </div>

        <div className="flex-1 min-w-0 pl-2">
          <p className="text-[13px] font-600 truncate text-white">{player.nickname}</p>
        </div>

        <span className="w-12 shrink-0 text-center text-[13px] font-600" style={{ color: '#A39B98' }}>
          {metricValue(player, activeColumn)}
        </span>

        <span
          className="w-14 shrink-0 text-right text-[13px] font-800"
          style={{ color: '#F2D8A7' }}
        >
          {player.points.toLocaleString('ru-RU')}
        </span>
      </div>
    </div>
  );
}

export function RatingPage() {
  const [activeTab, setActiveTab] = useState<RatingTab>('general');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [activeColumn, setActiveColumn] = useState<MetricColumn>('tournaments');
  const directionRef = useRef<number>(1);

  const handleTabChange = (tab: RatingTab) => {
    if (tab === activeTab) return;
    directionRef.current = tab === 'seasonal' ? 1 : -1;
    if (tab === 'seasonal') setSelectedMonth(new Date().getMonth());
    setActiveTab(tab);
  };

  const prevMonth = () => setSelectedMonth((m) => (m === 0 ? 11 : m - 1));
  const nextMonth = () => setSelectedMonth((m) => (m === 11 ? 0 : m + 1));

  const players: RatingPlayer[] =
    activeTab === 'general'
      ? MOCK_PLAYERS_GENERAL
      : (MOCK_PLAYERS_SEASONAL[selectedMonth] ?? []);

  return (
    <div className="flex flex-col h-full bg-obsidian">
      <div className="flex-shrink-0 px-5 pt-6 pb-4 space-y-4">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase">
          РЕЙТИНГ
        </h1>

        <div className="relative flex rounded-xl p-1" style={{ background: '#1E1612' }}>
          {(['general', 'seasonal'] as RatingTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className="relative flex-1 py-2.5 text-[13px] font-600 rounded-lg transition-colors"
              style={{ color: activeTab === tab ? '#0A0908' : '#6B6360' }}
            >
              {activeTab === tab && (
                <motion.span
                  layoutId="rating-tab-active"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.38 }}
                />
              )}
              <span className="relative z-10">
                {tab === 'general' ? 'Общий' : 'Сезонный'}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence initial={false}>
          {activeTab === 'seasonal' && (
            <motion.div
              key="month-nav"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div
                className="flex items-center justify-between rounded-xl px-2 py-2"
                style={{ background: '#1E1612' }}
              >
                <button
                  onClick={prevMonth}
                  className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  style={{ color: '#A39B98' }}
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <span className="text-[15px] font-700 text-white tracking-wide">
                  {MONTHS[selectedMonth]}
                </span>
                <button
                  onClick={nextMonth}
                  className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  style={{ color: '#A39B98' }}
                >
                  <ChevronRight size={18} strokeWidth={2.5} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-600 uppercase tracking-wider shrink-0" style={{ color: '#69584f' }}>
            Показатель
          </p>
          <div className="flex items-center justify-end gap-2 min-w-0">
            <ColumnSelector active={activeColumn} onChange={setActiveColumn} />
            <span
              className="shrink-0 text-[10px] font-800 uppercase tracking-wider"
              style={{ color: '#D99962' }}
            >
              Рейтинг
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false} custom={directionRef.current}>
          <motion.div
            key={activeTab + (activeTab === 'seasonal' ? `-${selectedMonth}` : '')}
            custom={directionRef.current}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 24 }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: d * -24 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0 scrollable pb-4"
          >
            {players.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <span className="text-4xl opacity-10 text-white">♠</span>
                <p className="text-[13px] font-500" style={{ color: '#6B6360' }}>
                  Данных за этот период нет
                </p>
              </div>
            ) : (
              <div className="px-4 space-y-2 pt-1">
                {players.map((p, idx) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    rank={idx + 1}
                    activeColumn={activeColumn}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
