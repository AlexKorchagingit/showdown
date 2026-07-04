import { User, Trophy, Star, Settings, ChevronRight } from 'lucide-react';

const MENU_ITEMS = [
  { icon: Trophy,   label: 'Мои турниры',    sub: '3 участия' },
  { icon: Star,     label: 'Мои достижения', sub: 'Посмотреть' },
  { icon: Settings, label: 'Настройки',      sub: '' },
];

export function ProfilePage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-5 pt-6 pb-4">
        <h1 className="text-center text-xl font-bold tracking-[0.2em] text-white uppercase">
          ПРОФИЛЬ
        </h1>
      </div>

      <div className="flex-1 scrollable px-4 pb-4 space-y-4">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="relative">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: '#5a1c0c',
                border: '2px solid rgba(217,153,98,0.45)',
                boxShadow: '0 0 16px rgba(217,153,98,0.2)',
              }}
            >
              <User size={36} strokeWidth={1.5} style={{ color: '#D99962' }} />
            </div>
            <div
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                background: 'linear-gradient(135deg, #8C4C27, #F2D8A7)',
                color: '#1d0b07',
              }}
            >
              1
            </div>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg">Игрок</p>
            <p className="text-xs mt-0.5" style={{ color: '#8C4C27' }}>Новичок</p>
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
              style={{
              background: '#5a1c0c',
              border: '1px solid rgba(140,76,39,0.35)',
              }}
            >
              <p className="text-white font-bold text-xl">{s.value}</p>
              <p className="text-[11px] mt-0.5" style={{ color: '#8C4C27' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Menu */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: '#5a1c0c',
            border: '1px solid rgba(140,76,39,0.3)',
          }}
        >
          {MENU_ITEMS.map(({ icon: Icon, label, sub }, idx) => (
            <button
              key={label}
              className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors active:brightness-125"
              style={{
                borderTop: idx > 0 ? '1px solid rgba(140,76,39,0.2)' : 'none',
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(140,76,39,0.35)' }}
              >
                <Icon size={16} style={{ color: '#D99962' }} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white text-sm font-medium">{label}</p>
                {sub && <p className="text-xs mt-0.5" style={{ color: '#8C4C27' }}>{sub}</p>}
              </div>
              <ChevronRight size={16} style={{ color: '#8C4C27' }} />
            </button>
          ))}
        </div>

        <p className="text-center text-xs pb-2" style={{ color: '#8C4C27' }}>
          SHOWDOWN v1.0.0
        </p>
      </div>
    </div>
  );
}
