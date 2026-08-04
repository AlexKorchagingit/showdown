import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Settings, ShoppingCart } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { CoinBalance } from '../components/CoinBalance';

const STATS = [
  { label: 'Рейтинг',  value: '#12', size: 'text-5xl' },
  { label: 'Победы',   value: 5,     size: 'text-4xl' },
  { label: 'Финалы',   value: 12,    size: 'text-3xl' },
  { label: 'Нокауты',  value: 47,    size: 'text-2xl' },
  { label: 'Игры',     value: 28,    size: 'text-lg' },
] as const;

const GOLD_NUM =
  'font-black text-transparent bg-clip-text bg-gradient-to-r from-[#D99962] to-[#F2D8A7] drop-shadow-[0_0_8px_rgba(217,153,98,0.8)]';

function formatBirthDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { nickname, birthDate, slogan, coins, characterImage, backgroundImage } = useProfile();
  const [isExpanded, setIsExpanded] = useState(false);

  const formattedBirthDate = formatBirthDate(birthDate);
  const trimmedSlogan = slogan.trim();

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
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[78%] w-auto object-contain z-0 pointer-events-none"
      />

      {/* Left-side readability mask — above bg/character, below stats */}
      <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-[#110b09]/90 via-[#110b09]/50 to-transparent z-[1] pointer-events-none" />

      {/* Header card */}
      <div className="relative z-10 mx-4 mt-6 px-5 py-3 rounded-2xl bg-[#110b09]/80 backdrop-blur-md border border-[#D99962]/20">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="absolute top-5 right-5 p-0 active:opacity-60 transition-opacity"
          aria-label="Настройки"
        >
          <Settings className="w-8 h-8 text-[#F2D8A7]" strokeWidth={2} />
        </button>

        <div className="pr-12">
          <h1 className="text-3xl font-black text-white leading-tight">{nickname}</h1>
          {formattedBirthDate && (
            <p className="text-sm text-[#8c8c88] mt-0.5">{formattedBirthDate}</p>
          )}
          {trimmedSlogan && (
            <p className="text-sm italic text-[#D99962]/90 mt-1 leading-snug">
              «{trimmedSlogan}»
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="w-full flex justify-center mt-2 pt-1 active:opacity-60 transition-opacity"
          aria-expanded={isExpanded}
          aria-label="Раскрыть раздел"
        >
          <ChevronDown
            size={22}
            className={`text-white transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        <motion.div
          initial={false}
          animate={{ height: isExpanded ? 'auto' : 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          <p className="text-sm text-[#A39B98] pt-2 pb-0.5 text-center">
            Здесь будет дополнительная информация
          </p>
        </motion.div>
      </div>

      {/* Left stats */}
      <div className="flex flex-col gap-4 mt-8 ml-4 relative z-10">
        {STATS.map(({ label, value, size }) => (
          <div key={label}>
            <p className="text-xs text-white font-bold drop-shadow-md uppercase tracking-wide">
              {label}
            </p>
            <p className={`${size} ${GOLD_NUM} leading-none mt-0.5`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Coins + shop — below the character */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-5 flex flex-col items-center">
        <div className="w-full flex justify-end mb-2.5">
          <CoinBalance coins={coins} />
        </div>

        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="w-full max-w-[260px] h-14 rounded-2xl flex items-center justify-center gap-2.5 text-[15px] font-bold tracking-wide text-[#0A0908] active:scale-[0.97] transition-transform"
          style={{
            background: 'linear-gradient(to right, #8C4C27, #D99962)',
            boxShadow: '0 0 24px rgba(217,153,98,0.32)',
          }}
        >
          <ShoppingCart size={19} strokeWidth={2.4} />
          МАГАЗИН
        </button>
      </div>
    </div>
  );
}
