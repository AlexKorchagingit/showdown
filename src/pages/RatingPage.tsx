import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crosshair, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import type { RatingPlayer } from '../types/player';
import { MOCK_PLAYERS_GENERAL, MOCK_PLAYERS_SEASONAL } from '../types/player';

type RatingTab = 'general' | 'seasonal';

const MONTHS = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

const rankColor = (rank: number): string => {
  if (rank === 1) return '#F2D8A7';
  if (rank === 2) return '#A39B98';
  if (rank === 3) return '#8C4C27';
  return '#6B6360';
};

// ─── Table header ─────────────────────────────────────────────────────────────
function TableHeader() {
  return (
    <div
      className="flex items-center px-4 py-2 text-[10px] font-600 uppercase tracking-wider"
      style={{ color: '#69584f' }}
    >
      <span className="w-7 shrink-0 text-center">#</span>
      <span className="w-8 shrink-0" />
      <span className="flex-1 min-w-0 pl-2">Никнейм</span>
      {/* Knockouts — Crosshair icon */}
      <span className="w-9 shrink-0 flex items-center justify-center">
        <Crosshair size={11} />
      </span>
      {/* Games played — "Турниры" */}
      <span className="w-12 shrink-0 text-center">Турниры</span>
      {/* Wins — Trophy icon */}
      <span className="w-9 shrink-0 flex items-center justify-center">
        <Trophy size={10} />
      </span>
      <span className="w-14 shrink-0 text-right">Рейтинг</span>
    </div>
  );
}

// ─── Single player row ────────────────────────────────────────────────────────
function PlayerRow({ player, rank }: { player: RatingPlayer; rank: number }) {
  const isTop3 = rank <= 3;

  return (
    <div
      className="flex items-center px-4 py-3"
      style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        background: isTop3 ? 'rgba(70,49,41,0.25)' : 'transparent',
      }}
    >
      <span
        className="w-7 shrink-0 text-center font-800 leading-none"
        style={{ fontSize: isTop3 ? '18px' : '13px', color: rankColor(rank) }}
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
        <p className="text-[13px] font-600 truncate"
           style={{ color: isTop3 ? '#ffffff' : '#A39B98' }}>
          {player.nickname}
        </p>
      </div>

      <span className="w-9 shrink-0 text-center text-[12px] font-500" style={{ color: '#A39B98' }}>
        {player.knockouts}
      </span>

      <span className="w-12 shrink-0 text-center text-[12px] font-500" style={{ color: '#A39B98' }}>
        {player.played}
      </span>

      <span className="w-9 shrink-0 text-center text-[12px] font-500" style={{ color: '#A39B98' }}>
        {player.won}
      </span>

      <span className="w-14 shrink-0 text-right text-[13px] font-800" style={{ color: '#F2D8A7' }}>
        {player.points.toLocaleString('ru-RU')}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function RatingPage() {
  const [activeTab, setActiveTab]         = useState<RatingTab>('general');
  // Default to actual current month
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const directionRef                      = useRef<number>(1);

  const handleTabChange = (tab: RatingTab) => {
    if (tab === activeTab) return;
    directionRef.current = tab === 'seasonal' ? 1 : -1;
    // When switching to seasonal, reset to the real current month
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
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-6 pb-4 space-y-4">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase">
          РЕЙТИНГ
        </h1>

        {/* Общий / Сезонный */}
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

        {/* Month navigator — prev/current/next (only in Seasonal tab) */}
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
      </div>

      {/* Table with directional slide */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false} custom={directionRef.current}>
          <motion.div
            key={activeTab + (activeTab === 'seasonal' ? `-${selectedMonth}` : '')}
            custom={directionRef.current}
            variants={{
              enter:  (d: number) => ({ opacity: 0, x: d * 24 }),
              center: { opacity: 1, x: 0 },
              exit:   (d: number) => ({ opacity: 0, x: d * -24 }),
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
              <div
                className="mx-4 rounded-2xl overflow-hidden"
                style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <TableHeader />
                {players.map((p, idx) => (
                  <PlayerRow key={p.id} player={p} rank={idx + 1} />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
