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
            background: '#400904',
            border: '1px solid rgba(217,153,98,0.25)',
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #8C4C27, #D99962)' }}
          >
            <Trophy size={22} style={{ color: '#0D0000' }} />
          </div>
          <div>
            <p className="text-white font-bold">Сезон Июль 2026</p>
            <p className="text-xs mt-0.5" style={{ color: '#D99962' }}>
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
                background: p.rank <= 3 ? '#400904' : 'rgba(64,9,4,0.6)',
                border: `1px solid ${p.rank <= 3 ? 'rgba(242,216,167,0.25)' : 'rgba(140,76,39,0.2)'}`,
              }}
            >
              <div className="w-8 text-center">
                {p.badge ? (
                  <span className="text-xl">{p.badge}</span>
                ) : (
                  <span className="font-bold text-sm" style={{ color: '#8C4C27' }}>
                    #{p.rank}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium text-sm">{p.name}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Medal size={13} style={{ color: '#D99962' }} />
                <span className="font-bold text-sm" style={{ color: '#F2D8A7' }}>
                  {p.points.toLocaleString('ru-RU')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Info */}
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            background: '#400904',
            border: '1px solid rgba(217,153,98,0.35)',
          }}
        >
          <BarChart2 size={18} className="shrink-0" style={{ color: '#D99962' }} />
          <p className="text-xs" style={{ color: '#D99962' }}>
            Полный рейтинг будет доступен после первого сезона турниров
          </p>
        </div>
      </div>
    </div>
  );
}
