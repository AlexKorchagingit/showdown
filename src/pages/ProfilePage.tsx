import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Settings } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';

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
  if (!iso) return 'Дата не указана';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return 'Дата не указана';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { nickname, birthDate, slogan } = useProfile();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <img
        src="/fon1_mountine.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover z-0"
      />
      <img
        src="/cat1_little.png"
        alt=""
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[78%] w-auto object-contain z-0 pointer-events-none"
      />

      {/* Left-side readability mask — above bg/cat, below stats */}
      <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-[#110b09]/90 via-[#110b09]/50 to-transparent z-[1] pointer-events-none" />

      {/* Header card */}
      <div className="relative z-10 mx-4 mt-6 px-5 py-3 rounded-2xl bg-gradient-to-br from-[#69584f]/70 via-[#463129]/80 to-[#231A16]/80 backdrop-blur-md border border-[#D99962]/30">
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
          <p className="text-sm text-[#8c8c88] mt-0.5">{formatBirthDate(birthDate)}</p>
          <p className="text-sm italic text-[#D99962]/90 mt-1 leading-snug">
            «{slogan}»
          </p>
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
    </div>
  );
}
