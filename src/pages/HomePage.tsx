import { Spade } from 'lucide-react';

export function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
      <div className="flex flex-col items-center gap-4">
        <div className="w-24 h-24 rounded-3xl bg-[#1A1A1A] border border-[rgba(212,175,55,0.2)] flex items-center justify-center shadow-gold">
          <Spade size={48} className="text-[#D4AF37]" strokeWidth={1.5} />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-widest text-white uppercase">SHOWDOWN</h1>
          <p className="text-[#A3A3A3] text-sm">Poker in Bryansk</p>
        </div>
      </div>

      <div className="w-full max-w-xs space-y-3">
        {['♠ Честная игра', '♥ Профессиональные дилеры', '♦ Лучшие турниры города', '♣ Рейтинговая система'].map(
          (item) => (
            <div
              key={item}
              className="flex items-center gap-3 bg-[#1A1A1A] border border-[rgba(212,175,55,0.1)] rounded-xl px-4 py-3"
            >
              <span className="text-[#D4AF37] text-sm font-medium">{item}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
