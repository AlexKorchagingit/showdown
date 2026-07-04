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
            background: '#463129',
            border: '1px solid rgba(200,163,142,0.25)',
            boxShadow: '0 0 22px rgba(200,163,142,0.3)',
          }}
        >
          <Spade size={48} className="text-[#c8a38e]" strokeWidth={1.5} />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-widest text-white uppercase">SHOWDOWN</h1>
          <p className="text-[#8c8c88] text-sm">Poker in Bryansk</p>
        </div>
      </div>

      <div className="w-full max-w-xs space-y-3">
        {FEATURES.map((item) => (
          <div
            key={item}
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              background: '#463129',
              border: '1px solid rgba(200,163,142,0.12)',
            }}
          >
            <span className="text-[#c8a38e] text-sm font-medium">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
