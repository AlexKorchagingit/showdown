import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Settings, ShoppingCart } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';

const STATS = [
  { label: 'Рейтинг',  value: '#12', size: 'text-5xl' },
  { label: 'Победы',   value: 5,     size: 'text-4xl' },
  { label: 'Финалы',   value: 12,    size: 'text-3xl' },
  { label: 'Нокауты',  value: 47,    size: 'text-2xl' },
  { label: 'Игры',     value: 28,    size: 'text-lg' },
] as const;

const EXTRA_STATS = [
  { label: 'Хедз-ап', value: 0 },
  { label: 'Топ 3',   value: 0 },
  { label: 'Топ 9',   value: 0 },
] as const;

const GOLD_TEXT = 'text-transparent bg-clip-text bg-gradient-to-r from-[#D99962] to-[#F2D8A7]';

const GOLD_NUM =
  `font-black ${GOLD_TEXT} drop-shadow-[0_0_8px_rgba(217,153,98,0.8)]`;

function formatBirthDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { nickname, birthDate, slogan, characterImage, backgroundImage } = useProfile();
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
        className="absolute left-[60%] -translate-x-1/2 bottom-[100px] h-[50%] w-auto object-contain z-0 pointer-events-none"
      />

      {/* Header card */}
      <div className="relative z-10 mx-4 mt-2 px-5 py-2 rounded-2xl bg-[#110b09]/40 backdrop-blur-md border border-[#D99962]/20">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="absolute top-5 right-5 p-0 active:opacity-60 transition-opacity"
          aria-label="Настройки"
        >
          <Settings className="w-8 h-8 text-[#F2D8A7]" strokeWidth={2} />
        </button>

        <div className="pr-12">
          <h1 className={`text-3xl font-black leading-tight ${GOLD_TEXT}`}>{nickname}</h1>
          {formattedBirthDate && (
            <p className="text-sm text-white/80 italic mt-0.5">{formattedBirthDate}</p>
          )}
          {trimmedSlogan && (
            <p className={`text-sm italic mt-2 leading-snug ${GOLD_TEXT}`}>
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
          <div className="flex flex-row justify-between items-center mt-4 pt-4 border-t border-white/10">
            <div className="flex flex-row gap-4">
              {EXTRA_STATS.map(({ label, value }) => (
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

      {/* Left stats — a soft blurred blob backs the numbers, no hard gradient edge */}
      <div className="relative mt-4 w-fit">
        <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-[180px] h-[120%] bg-[#231A16]/80 blur-[40px] rounded-full z-0 pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4 pl-4 pr-8">
          {STATS.map(({ label, value, size }) => (
            <div key={label}>
              <p className="text-xs text-white font-bold drop-shadow-md uppercase tracking-wide">
                {label}
              </p>
              <p className={`${size} ${GOLD_NUM} leading-none mt-0.5`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Shop — below the character */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-5 flex flex-col items-center">
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
