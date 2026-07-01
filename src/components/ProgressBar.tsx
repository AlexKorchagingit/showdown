interface Props {
  value: number;
  max: number;
  className?: string;
}

export function ProgressBar({ value, max, className = '' }: Props) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const isAlmostFull = percent >= 80;
  const isFull = percent >= 100;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#A3A3A3]">
          Зарегистрировано:{' '}
          <span className="text-white font-bold">{value}</span>
          <span className="text-[#5A5A5A]"> / {max}</span>
        </span>
        <span
          className={`font-bold text-sm ${
            isFull ? 'text-red-400' : isAlmostFull ? 'text-orange-400' : 'text-[#D4AF37]'
          }`}
        >
          {percent}%
        </span>
      </div>

      <div className="relative h-3 bg-[#2E2E2E] rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percent}%`,
            background: isFull
              ? 'linear-gradient(90deg, #ef4444, #dc2626)'
              : isAlmostFull
              ? 'linear-gradient(90deg, #D4AF37, #FF8C00)'
              : 'linear-gradient(90deg, #A8860C, #FFD700)',
            boxShadow: `0 0 8px ${isFull ? 'rgba(239,68,68,0.5)' : 'rgba(212,175,55,0.5)'}`,
          }}
        />
        {/* Tick marks */}
        {Array.from({ length: max / 4 - 1 }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-[#1A1A1A] opacity-40"
            style={{ left: `${((i + 1) * 4 / max) * 100}%` }}
          />
        ))}
      </div>

      <div className="flex justify-between text-[11px] text-[#5A5A5A]">
        <span>0</span>
        <span className="text-[#A3A3A3]">Осталось: {max - value}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
