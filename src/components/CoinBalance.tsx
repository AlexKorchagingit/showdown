import { Gem } from 'lucide-react';

interface Props {
  coins: number;
  className?: string;
  compact?: boolean;
}

export function CoinBalance({ coins, className = '', compact = false }: Props) {
  return (
    <div
      className={`inline-flex items-center rounded-full bg-[#1d0b07] border border-[#D99962]/40 ${
        compact ? 'gap-1 px-2 py-0.5' : 'gap-1.5 px-3 py-1'
      } ${className}`}
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.45)' }}
    >
      <Gem size={compact ? 13 : 16} strokeWidth={2.3} className="text-[#D99962]" />
      <span
        className={`font-bold text-[#F2D8A7] tabular-nums ${compact ? 'text-[12px]' : 'text-[14px]'}`}
      >
        {coins.toLocaleString('ru-RU')}
      </span>
    </div>
  );
}
