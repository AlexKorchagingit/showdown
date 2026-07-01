import { BarChart2, Trophy, Medal } from 'lucide-react';

const MOCK_PLAYERS = [
  { rank: 1, name: 'Александр К.', points: 4200, badge: '👑' },
  { rank: 2, name: 'Дмитрий В.', points: 3850, badge: '🥈' },
  { rank: 3, name: 'Михаил С.', points: 3610, badge: '🥉' },
  { rank: 4, name: 'Андрей П.', points: 2980, badge: null },
  { rank: 5, name: 'Сергей Н.', points: 2740, badge: null },
];

export function RatingPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-5 pt-6 pb-4">
        <h1 className="text-center text-xl font-bold tracking-[0.2em] text-white uppercase">
          РЕЙТИНГ
        </h1>
      </div>

      <div className="flex-1 scrollable px-4 pb-4 space-y-3">
        <div className="rounded-2xl bg-[#1A1A1A] border border-[rgba(212,175,55,0.2)] p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gold-gradient flex items-center justify-center shrink-0">
            <Trophy size={22} className="text-[#0A0A0A]" />
          </div>
          <div>
            <p className="text-white font-bold">Сезон Июль 2026</p>
            <p className="text-[#A3A3A3] text-xs mt-0.5">Рейтинг обновляется после каждого турнира</p>
          </div>
        </div>

        <div className="space-y-2">
          {MOCK_PLAYERS.map((p) => (
            <div
              key={p.rank}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
                p.rank <= 3
                  ? 'bg-[#1E1A0E] border-[rgba(212,175,55,0.25)]'
                  : 'bg-[#1A1A1A] border-[rgba(255,255,255,0.05)]'
              }`}
            >
              <div className="w-8 text-center">
                {p.badge ? (
                  <span className="text-xl">{p.badge}</span>
                ) : (
                  <span className="text-[#5A5A5A] font-bold text-sm">#{p.rank}</span>
                )}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium text-sm">{p.name}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Medal size={13} className="text-[#D4AF37]" />
                <span className="text-[#D4AF37] font-bold text-sm">{p.points.toLocaleString('ru-RU')}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 rounded-xl px-4 py-3 border border-[rgba(212,175,55,0.4)] bg-[#1E1A0E]">
          <BarChart2 size={18} className="text-[#D4AF37] shrink-0" />
          <p className="text-[#A3A3A3] text-xs">
            Полный рейтинг будет доступен после первого сезона турниров
          </p>
        </div>
      </div>
    </div>
  );
}
