import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface Props {
  features: string[];
  onChange: (features: string[]) => void;
  placeholder?: string;
}

export function FeatureListEditor({
  features,
  onChange,
  placeholder = 'Например: Неиграющие дилеры',
}: Props) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    onChange([...features, value]);
    setDraft('');
  };

  const remove = (index: number) => {
    onChange(features.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          className="flex-1 min-w-0 bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#D99962]/60 transition-colors"
        />
        <button
          type="button"
          onClick={add}
          disabled={draft.trim().length === 0}
          aria-label="Добавить пункт"
          className={`shrink-0 h-[46px] px-4 rounded-xl flex items-center gap-1.5 text-[13px] font-700 transition-all active:scale-95 ${
            draft.trim().length === 0 ? 'opacity-40 cursor-not-allowed' : ''
          }`}
          style={{
            background: 'linear-gradient(to right, #2A211D, #463129)',
            border: '1px solid rgba(217,153,98,0.35)',
            color: '#D99962',
          }}
        >
          <Plus size={15} strokeWidth={2.6} />
          Пункт
        </button>
      </div>

      {features.length === 0 ? (
        <p className="text-[12px] font-500" style={{ color: '#6B6360' }}>
          Особенности не добавлены
        </p>
      ) : (
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li
              key={`${feature}-${index}`}
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
              style={{ background: '#231A16', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span style={{ color: '#8C4C27', marginTop: 2 }}>•</span>
              <span className="flex-1 min-w-0 text-[13px] font-400" style={{ color: '#A39B98' }}>
                {feature}
              </span>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Удалить пункт: ${feature}`}
                className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center active:scale-95 transition-transform"
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.35)',
                }}
              >
                <X size={12} strokeWidth={2.8} style={{ color: '#f87171' }} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
