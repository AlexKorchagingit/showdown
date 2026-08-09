import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { useUser } from '../context/UserContext';
import { SLOGAN_PLACEHOLDER } from '../lib/userStorage';

interface Props {
  userEmail: string;
}

function handleLogout() {
  localStorage.removeItem('userEmail');
  window.location.reload();
}

export function SettingsPage({ userEmail }: Props) {
  const navigate = useNavigate();
  const { isAdmin } = useUser();
  const { nickname, slogan, updateNickname, updateSlogan } = useProfile();

  const [draftNickname, setDraftNickname] = useState(nickname);
  const [draftSlogan, setDraftSlogan] = useState(slogan);

  const handleSave = () => {
    updateNickname(draftNickname.trim() || nickname);
    updateSlogan(draftSlogan.trim());
    navigate('/profile');
  };

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

      {isAdmin && (
        <button
          type="button"
          onClick={() => navigate('/admin/users')}
          className="absolute top-4 right-4 z-50 w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(28,20,16,0.78)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(217,153,98,0.28)',
          }}
          aria-label="Админ-панель"
        >
          <ShieldCheck size={22} strokeWidth={2.2} style={{ color: '#D99962' }} />
        </button>
      )}

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
              value={draftNickname}
              onChange={(e) => setDraftNickname(e.target.value)}
              maxLength={17}
              className="w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 outline-none focus:border-[#D99962]/60 transition-colors"
              placeholder="Ваш никнейм"
            />
            <p className="text-[11px] mt-1 text-[#6B6360]">(макс. 17 символов)</p>
          </section>

          <section>
            <label className="block text-[11px] font-700 uppercase tracking-[0.18em] mb-2 text-[#D99962]">
              Слоган
            </label>
            <input
              type="text"
              value={draftSlogan}
              onChange={(e) => setDraftSlogan(e.target.value)}
              maxLength={60}
              className="w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 outline-none focus:border-[#D99962]/60 transition-colors"
              placeholder={SLOGAN_PLACEHOLDER}
            />
            <p className="text-right text-[11px] mt-1 text-[#6B6360]">{draftSlogan.length}/60</p>
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

          <button
            type="button"
            onClick={handleSave}
            className="w-full bg-gradient-to-r from-[#8C4C27] to-[#D99962] text-white font-bold py-3 rounded-xl active:scale-[0.98] transition-transform"
          >
            Сохранить изменения
          </button>
        </div>

        <div className="mt-10">
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
