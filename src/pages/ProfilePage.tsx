import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Settings, ShoppingCart } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { CURRENT_PLAYER_STATS } from '../data/playerStats';

const SIDE_STAT_SIZES = ['text-4xl', 'text-3xl', 'text-2xl', 'text-xl', 'text-lg'] as const;

const SIDE_STATS_SOURCE = [
  {
    label: 'Рейтинг',
    numeric: CURRENT_PLAYER_STATS.ratingPlace,
    display: `#${CURRENT_PLAYER_STATS.ratingPlace}`,
  },
  { label: 'Победы', numeric: CURRENT_PLAYER_STATS.wins, display: String(CURRENT_PLAYER_STATS.wins) },
  { label: 'Финалы', numeric: CURRENT_PLAYER_STATS.finals, display: String(CURRENT_PLAYER_STATS.finals) },
  {
    label: 'Нокауты',
    numeric: CURRENT_PLAYER_STATS.knockouts,
    display: String(CURRENT_PLAYER_STATS.knockouts),
  },
  { label: 'Игры', numeric: CURRENT_PLAYER_STATS.games, display: String(CURRENT_PLAYER_STATS.games) },
];

const EXTRA_STATS_SOURCE = [
  { label: 'Хедз-ап', value: CURRENT_PLAYER_STATS.headsUp },
  { label: 'Топ 3', value: CURRENT_PLAYER_STATS.top3 },
  { label: 'Топ 9', value: CURRENT_PLAYER_STATS.finals },
];

const GOLD_TEXT = 'text-transparent bg-clip-text bg-gradient-to-r from-[#D99962] to-[#F2D8A7]';

const GOLD_NUM =
  `font-black ${GOLD_TEXT} drop-shadow-[0_0_8px_rgba(217,153,98,0.8)]`;

export function ProfilePage() {
  const navigate = useNavigate();
  const { nickname, slogan, characterImage, backgroundImage } = useProfile();
  const [isExpanded, setIsExpanded] = useState(false);

  const trimmedSlogan = slogan.trim();

  const sideStats = useMemo(
    () =>
      SIDE_STATS_SOURCE.filter((stat) => stat.numeric > 0).map((stat, index) => ({
        ...stat,
        size: SIDE_STAT_SIZES[Math.min(index, SIDE_STAT_SIZES.length - 1)],
      })),
    [],
  );

  const extraStats = useMemo(
    () => EXTRA_STATS_SOURCE.filter((stat) => stat.value > 0),
    [],
  );

  return (
    <div className="relative w-full h-full overflow-hidden">
      <img
        src={backgroundImage}
        alt=""
        className="absolute inset-0 w-full h-full object-cover z-0"
      />
      <img
        src={characterImage}
        alt=""
        className="absolute bottom-[50px] left-[18%] h-[57%] w-auto object-contain object-bottom z-0 pointer-events-none"
      />

      {/* Header card */}
      <div className="relative z-10 mx-4 mt-2 px-4 pt-2 pb-1 rounded-2xl bg-[#110b09]/40 backdrop-blur-md border border-[#D99962]/20">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="absolute top-3 right-3 p-0 active:opacity-60 transition-opacity"
          aria-label="Настройки"
        >
          <Settings className="w-7 h-7 text-[#F2D8A7]" strokeWidth={2} />
        </button>

        <div className="pr-10 min-w-0">
          <h1 className={`text-2xl font-black leading-tight ${GOLD_TEXT}`}>{nickname}</h1>
          {trimmedSlogan && (
            <p
              className={`text-xs italic mt-1 leading-snug text-wrap break-words whitespace-normal line-clamp-2 ${GOLD_TEXT}`}
            >
              «{trimmedSlogan}»
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="w-full flex justify-center mt-0.5 active:opacity-60 transition-opacity"
          aria-expanded={isExpanded}
          aria-label="Раскрыть раздел"
        >
          <ChevronDown
            size={20}
            className={`text-white transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        <motion.div
          initial={false}
          animate={{ height: isExpanded ? 'auto' : 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div className="flex flex-row justify-between items-center mt-2 pt-3 border-t border-white/10 gap-3 pb-1">
            <div className="flex flex-row gap-4">
              {extraStats.map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center">
                  <span className="text-lg font-bold text-[#D99962] leading-none">{value}</span>
                  <span className="text-white/60 text-[10px] uppercase mt-1 whitespace-nowrap">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => navigate('/achievements')}
              className="shrink-0 bg-gradient-to-r from-[#8C4C27] to-[#D99962] text-white text-sm font-bold px-4 py-2 rounded-lg active:scale-95 transition-transform"
            >
              Достижения
            </button>
          </div>
        </motion.div>
      </div>

      {/* Left stats */}
      {sideStats.length > 0 && (
        <div className="relative mt-4 w-fit">
          <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-[160px] h-[150%] bg-[#231A16]/80 blur-[30px] rounded-full z-0 pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-3 pl-4 pr-8">
            {sideStats.map(({ label, display, size }) => (
              <div key={label}>
                <p className="text-[10px] text-white font-bold drop-shadow-md uppercase tracking-wide">
                  {label}
                </p>
                <p className={`${size} ${GOLD_NUM} leading-none mt-0.5`}>{display}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shop */}
      <div className="absolute bottom-2 left-0 right-0 z-10 px-4 flex flex-col items-center">
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="w-full max-w-[200px] h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-bold tracking-wide text-[#0A0908] py-2 px-4 active:scale-[0.97] transition-transform"
          style={{
            background: 'linear-gradient(to right, #8C4C27, #D99962)',
            boxShadow: '0 0 18px rgba(217,153,98,0.28)',
          }}
        >
          <ShoppingCart size={16} strokeWidth={2.4} />
          МАГАЗИН
        </button>
      </div>
    </div>
  );
}
