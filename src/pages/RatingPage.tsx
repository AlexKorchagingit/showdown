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
    <div className="flex flex-col h-full bg-obsidian">
      <div className="flex-shrink-0 px-5 pt-6 pb-4">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase">
          РЕЙТИНГ
        </h1>
      </div>

      <div className="flex-1 scrollable px-4 pb-4 space-y-3">
        {/* Season banner */}
        <div
          className="rounded-2xl p-4 flex items-center gap-4"
          style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
          >
            <Trophy size={22} style={{ color: '#0A0908' }} />
          </div>
          <div>
            <p className="text-white font-700 text-[14px]">Сезон Июль 2026</p>
            <p className="text-[12px] font-500 mt-0.5" style={{ color: '#A39B98' }}>
              Рейтинг обновляется после каждого турнира
            </p>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="space-y-2">
          {MOCK_PLAYERS.map((p) => (
            <div
              key={p.rank}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{
                background: p.rank <= 3 ? '#2A211D' : 'rgba(42,33,29,0.5)',
                border: `1px solid ${p.rank <= 3 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
              }}
            >
              <div className="w-8 text-center">
                {p.badge
                  ? <span className="text-xl">{p.badge}</span>
                  : <span className="font-700 text-[13px]" style={{ color: '#6B6360' }}>#{p.rank}</span>
                }
              </div>
              <div className="flex-1">
                <p className="text-white font-600 text-[13px]">{p.name}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Medal size={13} style={{ color: '#c8a38e' }} />
                <span className="font-700 text-[13px]" style={{ color: '#F2D8A7' }}>
                  {p.points.toLocaleString('ru-RU')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Info note */}
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3.5"
          style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <BarChart2 size={18} className="shrink-0" style={{ color: '#c8a38e' }} />
          <p className="text-[12px] font-500 leading-relaxed" style={{ color: '#A39B98' }}>
            Полный рейтинг будет доступен после первого сезона турниров
          </p>
        </div>
      </div>
    </div>
  );
}
