import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Settings } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';

const STATS = [
  { label: 'Победы',    value: 5,  size: 'text-4xl' },
  { label: 'Финалы',    value: 12, size: 'text-3xl' },
  { label: 'Нокауты',   value: 47, size: 'text-2xl' },
  { label: 'Кол-во игр', value: 28, size: 'text-xl' },
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
  const [expanded, setExpanded] = useState(false);

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
        className="absolute bottom-10 left-1/2 -translate-x-1/2 h-[65%] w-auto object-contain z-0 pointer-events-none"
      />

      {/* Header card */}
      <div className="relative z-10 mx-4 mt-6 p-5 rounded-2xl bg-gradient-to-br from-[#463129]/90 to-[#231A16]/90 backdrop-blur-md border border-[#D99962]/30">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="absolute top-4 right-4 p-0 active:opacity-60 transition-opacity"
          aria-label="Настройки"
        >
          <Settings size={22} strokeWidth={2} style={{ color: '#D99962' }} />
        </button>

        <div className="pr-10">
          <h1 className="text-3xl font-black text-white leading-tight">{nickname}</h1>
          <p className="text-sm text-[#8c8c88] mt-1">{formatBirthDate(birthDate)}</p>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex justify-center mt-4 pt-2 active:opacity-60 transition-opacity"
          aria-expanded={expanded}
          aria-label="Раскрыть раздел"
        >
          <ChevronDown
            size={22}
            className={`text-white/40 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="accordion"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Left stats */}
      <div className="flex flex-col gap-4 mt-8 ml-4 relative z-10">
        {STATS.map(({ label, value, size }) => (
          <div key={label}>
            <p className="text-xs text-[#8c8c88] font-600 uppercase tracking-wide">{label}</p>
            <p className={`${size} ${GOLD_NUM} leading-none mt-0.5`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Slogan */}
      <p className="absolute bottom-6 left-0 right-0 z-10 font-serif italic text-center text-lg text-white/90 drop-shadow-md px-6 pointer-events-none">
        «{slogan}»
      </p>
    </div>
  );
}
