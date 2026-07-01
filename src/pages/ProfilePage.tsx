import { User, Trophy, Star, Settings, ChevronRight } from 'lucide-react';

const MENU_ITEMS = [
  { icon: Trophy, label: 'Мои турниры', sub: '3 участия' },
  { icon: Star, label: 'Мои достижения', sub: 'Посмотреть' },
  { icon: Settings, label: 'Настройки', sub: '' },
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
        {/* Avatar block */}
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-[#2A2A2A] border-2 border-[rgba(212,175,55,0.4)] flex items-center justify-center">
              <User size={36} className="text-[#D4AF37]" strokeWidth={1.5} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gold-gradient flex items-center justify-center text-[#0A0A0A] text-xs font-bold">
              1
            </div>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg">Игрок</p>
            <p className="text-[#5A5A5A] text-xs mt-0.5">Новичок</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Турниры', value: '3' },
            { label: 'Победы', value: '0' },
            { label: 'Очки', value: '0' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl bg-[#1A1A1A] border border-[rgba(212,175,55,0.1)] p-3 text-center"
            >
              <p className="text-white font-bold text-xl">{s.value}</p>
              <p className="text-[#5A5A5A] text-[11px] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Menu */}
        <div className="rounded-2xl bg-[#1A1A1A] border border-[rgba(255,255,255,0.05)] overflow-hidden divide-y divide-[rgba(255,255,255,0.05)]">
          {MENU_ITEMS.map(({ icon: Icon, label, sub }) => (
            <button
              key={label}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-[#242424] transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-[#242424] flex items-center justify-center shrink-0">
                <Icon size={16} className="text-[#D4AF37]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white text-sm font-medium">{label}</p>
                {sub && <p className="text-[#5A5A5A] text-xs mt-0.5">{sub}</p>}
              </div>
              <ChevronRight size={16} className="text-[#5A5A5A]" />
            </button>
          ))}
        </div>

        <p className="text-center text-[#3A3A3A] text-xs pb-2">SHOWDOWN v1.0.0</p>
      </div>
    </div>
  );
}
