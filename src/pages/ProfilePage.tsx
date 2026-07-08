import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';

export function ProfilePage() {
  const navigate = useNavigate();
  const { nickname, slogan } = useProfile();

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#110b09]">
      <img
        src="/fon1_mountine.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div
        className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-6 pb-3"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 1.5rem)',
          background: 'linear-gradient(to bottom, rgba(17,11,9,0.55) 0%, transparent 100%)',
        }}
      >
        <h1 className="text-[18px] font-800 text-white tracking-wide truncate pr-4">
          {nickname}
        </h1>
        <button
          type="button"
          onClick={() => navigate('/profile/settings')}
          className="shrink-0 p-1 active:opacity-60 transition-opacity"
          aria-label="Настройки"
        >
          <Settings size={24} strokeWidth={2} style={{ color: '#D99962' }} />
        </button>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-6"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.5rem)',
          background: 'linear-gradient(to top, rgba(17,11,9,0.65) 0%, transparent 70%)',
        }}
      >
        <img
          src="/cat1_little.png"
          alt=""
          className="w-[min(72vw,280px)] h-auto object-contain mb-4"
          style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.45))' }}
        />
        <p
          className="text-center text-[17px] font-600 italic leading-relaxed max-w-[90%] pb-2"
          style={{
            color: '#F2D8A7',
            fontFamily: 'Montserrat, sans-serif',
            letterSpacing: '0.02em',
            textShadow: '0 2px 12px rgba(0,0,0,0.6)',
          }}
        >
          «{slogan}»
        </p>
      </div>
    </div>
  );
}
