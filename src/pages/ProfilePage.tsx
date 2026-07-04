import { User, Trophy, Star, Settings, ChevronRight } from 'lucide-react';

const MENU_ITEMS = [
  { icon: Trophy,   label: 'Мои турниры',    sub: '3 участия' },
  { icon: Star,     label: 'Мои достижения', sub: 'Посмотреть' },
  { icon: Settings, label: 'Настройки',      sub: '' },
];

export function ProfilePage() {
  return (
    <div className="flex flex-col h-full bg-obsidian">
      <div className="flex-shrink-0 px-5 pt-6 pb-4">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase">
          ПРОФИЛЬ
        </h1>
      </div>

      <div className="flex-1 scrollable px-4 pb-4 space-y-4">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 py-5">
          <div className="relative">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: '#2A211D',
                border: '2px solid rgba(200,163,142,0.35)',
                boxShadow: '0 0 20px rgba(200,163,142,0.12)',
              }}
            >
              <User size={36} strokeWidth={1.5} style={{ color: '#c8a38e' }} />
            </div>
            <div
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-800"
              style={{
                background: 'linear-gradient(to right, #8C4C27, #D99962)',
                color: '#0A0908',
              }}
            >
              1
            </div>
          </div>
          <div className="text-center">
            <p className="text-white font-700 text-[17px]">Игрок</p>
            <p className="text-[12px] font-500 mt-0.5" style={{ color: '#6B6360' }}>Новичок</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Турниры', value: '3' },
            { label: 'Победы',  value: '0' },
            { label: 'Очки',    value: '0' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-3 text-center"
              style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-white font-800 text-[22px]">{s.value}</p>
              <p className="text-[11px] font-500 mt-0.5" style={{ color: '#6B6360' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Menu */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          {MENU_ITEMS.map(({ icon: Icon, label, sub }, idx) => (
            <button
              key={label}
              className="w-full flex items-center gap-3.5 px-4 py-4 active:brightness-125 transition-all"
              style={{ borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(140,76,39,0.18)' }}
              >
                <Icon size={16} style={{ color: '#D99962' }} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white text-[13px] font-600">{label}</p>
                {sub && <p className="text-[11px] font-500 mt-0.5" style={{ color: '#6B6360' }}>{sub}</p>}
              </div>
              <ChevronRight size={16} style={{ color: '#6B6360' }} />
            </button>
          ))}
        </div>

        <p className="text-center text-[11px] font-500 pb-2" style={{ color: '#2A211D' }}>
          SHOWDOWN v1.0.0
        </p>
      </div>
    </div>
  );
}
