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
                background: '#50444c',
                border: '2px solid rgba(200,163,142,0.4)',
              }}
            >
              <User size={36} className="text-[#c8a38e]" strokeWidth={1.5} />
            </div>
            <div
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[#110b09] text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #94543c, #c8a38e)' }}
            >
              1
            </div>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg">Игрок</p>
            <p className="text-[#69584f] text-xs mt-0.5">Новичок</p>
          </div>
        </div>

        {/* Stats grid */}
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
                background: '#463129',
                border: '1px solid rgba(200,163,142,0.12)',
              }}
            >
              <p className="text-white font-bold text-xl">{s.value}</p>
              <p className="text-[#69584f] text-[11px] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Menu */}
        <div
          className="rounded-2xl overflow-hidden divide-y"
          style={{
            background: '#463129',
            border: '1px solid rgba(255,255,255,0.05)',
            ['--tw-divide-opacity' as string]: '1',
          }}
        >
          {MENU_ITEMS.map(({ icon: Icon, label, sub }) => (
            <button
              key={label}
              className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.05)' }}
              onPointerDown={(e) =>
                (e.currentTarget.style.background = '#50444c')
              }
              onPointerUp={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
              onPointerLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: '#514f4c' }}
              >
                <Icon size={16} className="text-[#c8a38e]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white text-sm font-medium">{label}</p>
                {sub && <p className="text-[#69584f] text-xs mt-0.5">{sub}</p>}
              </div>
              <ChevronRight size={16} className="text-[#69584f]" />
            </button>
          ))}
        </div>

        <p className="text-center text-[#514f4c] text-xs pb-2">SHOWDOWN v1.0.0</p>
      </div>
    </div>
  );
}
