interface Props {
  value: number;
  max: number;
  className?: string;
}

export function ProgressBar({ value, max, className = '' }: Props) {
  const percent     = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const isAlmostFull = percent >= 80;
  const isFull      = percent >= 100;

  const barGradient = isFull
    ? 'linear-gradient(90deg, #ef4444, #dc2626)'
    : isAlmostFull
    ? 'linear-gradient(90deg, #D99962, #ef4444)'
    : 'linear-gradient(90deg, #8C4C27, #F2D8A7)';

  const barGlow = isFull
    ? 'rgba(239,68,68,0.5)'
    : 'rgba(217,153,98,0.5)';

  const percentColor = isFull ? '#ef4444' : isAlmostFull ? '#D99962' : '#F2D8A7';

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: '#D99962' }}>
          Зарегистрировано:{' '}
          <span className="text-white font-bold">{value}</span>
          <span style={{ color: '#8C4C27' }}> / {max}</span>
        </span>
        <span className="font-bold text-sm" style={{ color: percentColor }}>
          {percent}%
        </span>
      </div>

      <div
        className="relative h-3 rounded-full overflow-hidden"
        style={{ background: 'rgba(140,76,39,0.3)' }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percent}%`,
            background: barGradient,
            boxShadow: `0 0 8px ${barGlow}`,
          }}
        />
        {Array.from({ length: max / 4 - 1 }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px opacity-30"
            style={{
              left: `${((i + 1) * 4 / max) * 100}%`,
              background: '#0D0000',
            }}
          />
        ))}
      </div>

      <div className="flex justify-between text-[11px]">
        <span style={{ color: '#8C4C27' }}>0</span>
        <span style={{ color: '#D99962' }}>Осталось: {max - value}</span>
        <span style={{ color: '#8C4C27' }}>{max}</span>
      </div>
    </div>
  );
}
