import { BarChart2, Trophy, Medal } from 'lucide-react';

const MOCK_PLAYERS = [
  { rank: 1, name: 'Александр К.', points: 4200, badge: '👑' },
  { rank: 2, name: 'Дмитрий В.',   points: 3850, badge: '🥈' },
  { rank: 3, name: 'Михаил С.',    points: 3610, badge: '🥉' },
  { rank: 4, name: 'Андрей П.',    points: 2980, badge: null },
  { rank: 5, name: 'Сергей Н.',    points: 2740, badge: null },
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
        {/* Season banner */}
        <div
          className="rounded-2xl p-4 flex items-center gap-4"
          style={{
            background: '#463129',
            border: '1px solid rgba(200,163,142,0.22)',
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #94543c, #c8a38e)' }}
          >
            <Trophy size={22} className="text-[#110b09]" />
          </div>
          <div>
            <p className="text-white font-bold">Сезон Июль 2026</p>
            <p className="text-[#8c8c88] text-xs mt-0.5">Рейтинг обновляется после каждого турнира</p>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="space-y-2">
          {MOCK_PLAYERS.map((p) => (
            <div
              key={p.rank}
              className="flex items-center gap-3 rounded-xl px-4 py-3 border transition-all"
              style={{
                background: p.rank <= 3 ? '#3d2820' : '#463129',
                borderColor: p.rank <= 3
                  ? 'rgba(200,163,142,0.28)'
                  : 'rgba(255,255,255,0.05)',
              }}
            >
              <div className="w-8 text-center">
                {p.badge ? (
                  <span className="text-xl">{p.badge}</span>
                ) : (
                  <span className="text-[#69584f] font-bold text-sm">#{p.rank}</span>
                )}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium text-sm">{p.name}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Medal size={13} className="text-[#c8a38e]" />
                <span className="text-[#c8a38e] font-bold text-sm">
                  {p.points.toLocaleString('ru-RU')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Info note */}
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            background: '#3d2820',
            border: '1px solid rgba(200,163,142,0.35)',
          }}
        >
          <BarChart2 size={18} className="text-[#c8a38e] shrink-0" />
          <p className="text-[#8c8c88] text-xs">
            Полный рейтинг будет доступен после первого сезона турниров
          </p>
        </div>
      </div>
    </div>
  );
}
