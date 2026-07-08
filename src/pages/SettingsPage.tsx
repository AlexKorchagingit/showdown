import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';

interface Props {
  userEmail: string;
}

function handleLogout() {
  localStorage.removeItem('userEmail');
  window.location.reload();
}

export function SettingsPage({ userEmail }: Props) {
  const navigate = useNavigate();
  const { nickname, birthDate, slogan, updateNickname, updateBirthDate, updateSlogan } = useProfile();

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <button
        type="button"
        onClick={() => navigate('/profile')}
        className="absolute top-4 left-4 z-50 w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(28,20,16,0.78)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(217,153,98,0.28)',
        }}
      >
        <ArrowLeft size={22} strokeWidth={2.2} style={{ color: '#D99962' }} />
      </button>

      <div
        className="flex-1 scrollable px-5 pt-20"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase mb-8">
          Настройки
        </h1>

        <div className="space-y-5">
          <section>
            <label className="block text-[11px] font-700 uppercase tracking-[0.18em] mb-2 text-[#D99962]">
              Никнейм
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => updateNickname(e.target.value)}
              className="w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 outline-none focus:border-[#D99962]/60 transition-colors"
              placeholder="Ваш никнейм"
            />
          </section>

          <section>
            <label className="block text-[11px] font-700 uppercase tracking-[0.18em] mb-2 text-[#D99962]">
              Дата рождения
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => updateBirthDate(e.target.value)}
              className="w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 outline-none focus:border-[#D99962]/60 transition-colors [color-scheme:dark]"
            />
          </section>

          <section>
            <label className="block text-[11px] font-700 uppercase tracking-[0.18em] mb-2 text-[#D99962]">
              Слоган
            </label>
            <input
              type="text"
              value={slogan}
              onChange={(e) => updateSlogan(e.target.value)}
              maxLength={60}
              className="w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 outline-none focus:border-[#D99962]/60 transition-colors"
              placeholder="Ваш слоган (макс. 60 символов)"
            />
            <p className="text-right text-[11px] mt-1 text-[#6B6360]">{slogan.length}/60</p>
          </section>

          <section>
            <label className="block text-[11px] font-700 uppercase tracking-[0.18em] mb-2 text-[#D99962]">
              Email
            </label>
            <div
              className="w-full rounded-xl px-4 py-3 text-[14px] font-500 break-all"
              style={{ background: '#2A211D', color: '#A39B98', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {userEmail || '—'}
            </div>
          </section>
        </div>

        <div className="mt-12">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full h-14 rounded-2xl flex items-center justify-center gap-2.5 text-[15px] font-700 text-white/90 active:scale-[0.98] transition-transform bg-gradient-to-r from-red-900/80 to-red-800/80 border border-red-700/50"
            style={{ boxShadow: '0 4px 20px rgba(127,29,29,0.25)' }}
          >
            <LogOut size={18} />
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
}
