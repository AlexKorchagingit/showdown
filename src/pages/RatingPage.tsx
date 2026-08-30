import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PlayerNameLink } from '../components/PlayerNameLink';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { useProfile } from '../context/ProfileContext';
import { useUser } from '../context/UserContext';
import { useTournaments } from '../context/TournamentContext';
import type { RatingPlayer } from '../types/player';
import { clubRatingPlayers } from '../lib/clubRating';
import {
  readRatingView,
  writeRatingView,
  type RatingMetricColumn,
  type RatingTab,
} from '../lib/ratingViewState';

type MetricColumn = RatingMetricColumn;

const MONTHS = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

const COLUMN_TABS: { id: MetricColumn; label: string }[] = [
  { id: 'tournaments', label: 'Турниры' },
  { id: 'wins', label: 'Победы' },
  { id: 'knockouts', label: 'Нокауты' },
];

const TOP3_GLOW: Record<number, string> = {
  1: '#D99962',
  2: '#8c8c88',
  3: '#8C4C27',
};

function rankClassName(rank: number): string {
  if (rank === 1) return 'text-[#D99962] drop-shadow-[0_0_8px_rgba(217,153,98,0.7)]';
  if (rank === 2) return 'text-[#9ca3af]';
  if (rank === 3) return 'text-[#b87333]';
  return 'text-white/70';
}

function metricValue(player: RatingPlayer, column: MetricColumn): number {
  if (column === 'tournaments') return player.played;
  if (column === 'wins') return player.won;
  return player.knockouts;
}

function initialFrom(nickname: string): string {
  const trimmed = nickname.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : '?';
}

function findCurrentEntry(
  players: RatingPlayer[],
  userId: string,
  nickname: string,
): { player: RatingPlayer; rank: number } {
  const index = players.findIndex((player) => player.id === userId);
  if (index >= 0) {
    return { player: players[index], rank: index + 1 };
  }

  const name = nickname.trim() || 'Вы';
  return {
    player: {
      id: userId || 'me',
      nickname: name,
      initial: initialFrom(name),
      points: 0,
      played: 0,
      won: 0,
      knockouts: 0,
    },
    rank: players.length + 1,
  };
}

function ColumnSelector({
  active,
  onChange,
}: {
  active: MetricColumn;
  onChange: (column: MetricColumn) => void;
}) {
  return (
    <div className="flex items-center gap-0" role="tablist" aria-label="Показатель таблицы">
      {COLUMN_TABS.map(({ id, label }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={
              isActive
                ? 'bg-[#D99962] text-[#110b09] text-[11px] font-bold rounded-md px-1.5 py-1'
                : 'text-[11px] text-[#8c8c88] hover:text-white px-1.5 py-1'
            }
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
  sticky = false,
}: {
  player: RatingPlayer;
  rank: number;
  activeColumn: MetricColumn;
  sticky?: boolean;
}) {
  const isTop3 = rank <= 3;
  const glowColor = isTop3 ? TOP3_GLOW[rank] : null;

  return (
    <div className="relative">
      {isTop3 && !sticky && (
        <div
          className="absolute inset-0 rounded-2xl animate-pulse pointer-events-none"
          style={{ boxShadow: `0 0 10px ${glowColor}` }}
        />
      )}

      <div
        className={
          sticky
            ? 'relative z-10 flex items-center px-4 py-3 rounded-2xl bg-gradient-to-r from-[#463129] to-[#231A16] border border-[#D99962]/50 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]'
            : 'relative z-10 flex items-center px-4 py-3 rounded-2xl'
        }
        style={
          sticky
            ? undefined
            : {
                background: isTop3 ? 'rgba(70,49,41,0.45)' : '#2A211D',
                border: isTop3
                  ? `1px solid ${glowColor}50`
                  : '1px solid rgba(255,255,255,0.05)',
              }
        }
      >
        <span className={`w-7 shrink-0 text-center font-800 leading-none text-[18px] ${rankClassName(rank)}`}>
          {rank}
        </span>

        <PlayerAvatar
          playerId={player.id}
          nickname={player.nickname}
          size="md"
          glowColor={isTop3 && !sticky ? glowColor ?? undefined : undefined}
          className="ml-1"
        />

        <div className="flex-1 min-w-0 pl-2">
          <PlayerNameLink
            id={player.id}
            nickname={player.nickname}
            className="text-[13px] font-600 truncate text-white block"
            stats={{
              ratingPlace: rank,
              points: player.points,
              played: player.played,
              won: player.won,
              knockouts: player.knockouts,
            }}
          />
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
  const { userId, clubUsers } = useUser();
  const { nickname } = useProfile();
  const { tournaments } = useTournaments();
  const savedView = useRef(readRatingView()).current;
  const [activeTab, setActiveTab] = useState<RatingTab>(savedView.tab);
  const [selectedMonth, setSelectedMonth] = useState<number>(savedView.month);
  const [activeColumn, setActiveColumn] = useState<MetricColumn>(savedView.column);
  const directionRef = useRef<number>(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const restoredScroll = useRef(false);

  const handleTabChange = (tab: RatingTab) => {
    if (tab === activeTab) return;
    directionRef.current = tab === 'seasonal' ? 1 : -1;
    const month = tab === 'seasonal' ? new Date().getMonth() : selectedMonth;
    if (tab === 'seasonal') setSelectedMonth(month);
    setActiveTab(tab);
    writeRatingView({ tab, month, scrollTop: 0 });
  };

  const prevMonth = () => {
    setSelectedMonth((m) => {
      const month = m === 0 ? 11 : m - 1;
      writeRatingView({ month, scrollTop: 0 });
      return month;
    });
  };
  const nextMonth = () => {
    setSelectedMonth((m) => {
      const month = m === 11 ? 0 : m + 1;
      writeRatingView({ month, scrollTop: 0 });
      return month;
    });
  };

  const setColumn = (column: MetricColumn) => {
    setActiveColumn(column);
    writeRatingView({ column });
  };

  const players = useMemo(
    () =>
      clubRatingPlayers(
        clubUsers,
        tournaments,
        activeTab === 'seasonal' ? selectedMonth : undefined,
      ),
    [clubUsers, tournaments, activeTab, selectedMonth],
  );

  const me = useMemo(
    () => findCurrentEntry(players, userId, nickname),
    [players, userId, nickname],
  );

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node || restoredScroll.current || players.length === 0) return;
    const top = readRatingView().scrollTop;
    restoredScroll.current = true;
    if (top <= 0) return;
    node.scrollTop = top;
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = top;
    });
    return () => cancelAnimationFrame(frame);
  }, [players.length, activeTab, selectedMonth]);

  return (
    <div className="relative flex flex-col h-full bg-obsidian">
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

        <div className="flex items-center justify-end gap-0">
          <ColumnSelector active={activeColumn} onChange={setColumn} />
          <span
            className="shrink-0 text-[10px] font-800 uppercase tracking-wider pl-0.5"
            style={{ color: '#D99962' }}
          >
            Рейтинг
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false} custom={directionRef.current}>
          <motion.div
            ref={scrollRef}
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
            onPointerDown={() => {
              const node = scrollRef.current;
              if (node) writeRatingView({ scrollTop: node.scrollTop });
            }}
            onScroll={() => {
              const node = scrollRef.current;
              if (!node) return;
              writeRatingView({ scrollTop: node.scrollTop });
            }}
            className="absolute inset-0 scrollable pb-28"
            style={{ overflowAnchor: 'none' }}
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

      <div className="absolute bottom-0 left-0 right-0 p-4 z-40 bg-gradient-to-t from-[#110b09] via-[#110b09]/95 to-transparent pb-safe">
        <PlayerRow
          player={me.player}
          rank={me.rank}
          activeColumn={activeColumn}
          sticky
        />
      </div>
    </div>
  );
}
