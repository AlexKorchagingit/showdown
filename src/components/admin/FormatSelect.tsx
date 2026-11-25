import { EVENT_FORMATS, EVENT_FORMAT_LABEL, type EventFormat } from '../../lib/eventFormat';

interface Props {
  value: EventFormat;
  onChange: (format: EventFormat) => void;
  disabled?: boolean;
}

export function FormatSelect({ value, onChange, disabled = false }: Props) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-700 uppercase tracking-[0.16em]" style={{ color: '#A39B98' }}>
        Формат
      </p>
      <div className="grid grid-cols-4 gap-1 rounded-xl p-1" style={{ background: '#1E1612' }}>
        {EVENT_FORMATS.map((format) => {
          const active = value === format;
          return (
            <button
              key={format}
              type="button"
              disabled={disabled}
              onClick={() => onChange(format)}
              className="rounded-lg px-1 py-2 text-[11px] font-700 leading-tight"
              style={{
                background: active ? 'linear-gradient(to right, #8C4C27, #D99962)' : 'transparent',
                color: active ? '#0A0908' : '#6B6360',
              }}
            >
              {EVENT_FORMAT_LABEL[format]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
