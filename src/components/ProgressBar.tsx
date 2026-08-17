interface Props {
  value: number;
  max: number;
  className?: string;
}

function seatsWord(count: number): string {
  const abs = Math.abs(count) % 100;
  const digit = abs % 10;
  if (abs > 10 && abs < 20) return 'мест';
  if (digit === 1) return 'место';
  if (digit >= 2 && digit <= 4) return 'места';
  return 'мест';
}

export function ProgressBar({ value, max, className = '' }: Props) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const isAlmostFull = percent >= 80;
  const isFull = percent >= 100;
  const free = Math.max(0, max - value);

  const barGrad = isFull
    ? 'linear-gradient(90deg, #ef4444, #dc2626)'
    : isAlmostFull
      ? 'linear-gradient(90deg, #D99962, #ef4444)'
      : 'linear-gradient(90deg, #8C4C27, #c8a38e)';

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-sm font-bold text-white">
        В игре: {value} / {max}
      </p>

      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: '#514f4c' }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percent}%`,
            background: barGrad,
            boxShadow: `0 0 8px ${isFull ? 'rgba(239,68,68,0.4)' : 'rgba(200,163,142,0.4)'}`,
          }}
        />
      </div>

      <p className="text-sm text-gray-400 text-right">
        Свободно: {free} {seatsWord(free)}
      </p>
    </div>
  );
}
