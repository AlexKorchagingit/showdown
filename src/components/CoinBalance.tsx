import { Coins } from 'lucide-react';

interface Props {
  coins: number;
  className?: string;
}

export function CoinBalance({ coins, className = '' }: Props) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-[#1d0b07] border border-[#D99962]/40 ${className}`}
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.45)' }}
    >
      <Coins size={16} strokeWidth={2.3} className="text-[#D99962]" />
      <span className="text-[14px] font-bold text-[#F2D8A7] tabular-nums">
        {coins.toLocaleString('ru-RU')}
      </span>
    </div>
  );
}
