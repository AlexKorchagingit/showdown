import { Spade } from 'lucide-react';

const FEATURES = [
  '♠ Честная игра',
  '♥ Профессиональные дилеры',
  '♦ Лучшие турниры города',
  '♣ Рейтинговая система',
];

export function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{
            background: '#5a1c0c',
            border: '1px solid rgba(217,153,98,0.3)',
            boxShadow: '0 0 28px rgba(217,153,98,0.35)',
          }}
        >
          <Spade size={48} strokeWidth={1.5} style={{ color: '#D99962' }} />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-widest text-white uppercase">SHOWDOWN</h1>
          <p className="text-sm" style={{ color: '#D99962' }}>Poker in Bryansk</p>
        </div>
      </div>

      <div className="w-full max-w-xs space-y-3">
        {FEATURES.map((item) => (
          <div
            key={item}
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              background: '#5a1c0c',
              border: '1px solid rgba(140,76,39,0.4)',
            }}
          >
            <span className="text-sm font-medium" style={{ color: '#F2D8A7' }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
