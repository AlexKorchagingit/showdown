interface Props {
  value: number;
  max: number;
  className?: string;
}

export function ProgressBar({ value, max, className = '' }: Props) {
  const percent      = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const isAlmostFull = percent >= 80;
  const isFull       = percent >= 100;

  const barGrad = isFull
    ? 'linear-gradient(90deg, #ef4444, #dc2626)'
    : isAlmostFull
    ? 'linear-gradient(90deg, #D99962, #ef4444)'
    : 'linear-gradient(90deg, #8C4C27, #c8a38e)';

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-[13px] font-500">
        <span style={{ color: '#A39B98' }}>
          Зарегистрировано:{' '}
          <span className="text-white font-700">{value}</span>
          <span style={{ color: '#6B6360' }}> / {max}</span>
        </span>
        <span className="font-700"
              style={{ color: isFull ? '#ef4444' : isAlmostFull ? '#D99962' : '#F2D8A7' }}>
          {percent}%
        </span>
      </div>

      {/* Smooth fill — no tick marks */}
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

      <div className="flex justify-between text-[11px] font-500">
        <span style={{ color: '#6B6360' }}>0</span>
        <span style={{ color: '#A39B98' }}>Осталось: {Math.max(0, max - value)}</span>
        <span style={{ color: '#6B6360' }}>{max}</span>
      </div>
    </div>
  );
}
