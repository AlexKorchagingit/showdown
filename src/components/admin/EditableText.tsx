import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Pencil, X } from 'lucide-react';

interface Props {
  value: string;
  onSave: (value: string) => void;
  /** Custom rendering of the saved value; falls back to plain text. */
  renderValue?: (value: string) => ReactNode;
  multiline?: boolean;
  type?: 'text' | 'date' | 'time' | 'number';
  maxLength?: number;
  placeholder?: string;
  rows?: number;
  pencilSize?: number;
  inputClassName?: string;
  className?: string;
}

const INPUT_BASE =
  'w-full bg-[#231A16] text-white border border-[#D99962]/40 rounded-xl px-3 py-2 text-[14px] outline-none focus:border-[#D99962] transition-colors';

export function EditableText({
  value,
  onSave,
  renderValue,
  multiline = false,
  type = 'text',
  maxLength,
  placeholder,
  rows = 4,
  pencilSize = 14,
  inputClassName = '',
  className = '',
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(value);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const commit = () => {
    onSave(draft.trim());
    setIsEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className={`flex items-start gap-2 ${className}`}>
        {multiline ? (
          <textarea
            ref={(el) => { inputRef.current = el; }}
            value={draft}
            rows={rows}
            maxLength={maxLength}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
            className={`${INPUT_BASE} resize-none ${inputClassName}`}
          />
        ) : (
          <input
            ref={(el) => { inputRef.current = el; }}
            type={type}
            value={draft}
            maxLength={maxLength}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
            className={`${INPUT_BASE} ${type === 'date' || type === 'time' ? '[color-scheme:dark]' : ''} ${inputClassName}`}
          />
        )}

        <div className="flex items-center gap-1 shrink-0 pt-1">
          <button
            type="button"
            onClick={commit}
            aria-label="Сохранить"
            className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
          >
            <Check size={14} strokeWidth={3} style={{ color: '#0A0908' }} />
          </button>
          <button
            type="button"
            onClick={cancel}
            aria-label="Отменить"
            className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-95 transition-transform"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <X size={14} strokeWidth={2.5} style={{ color: '#A39B98' }} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex-1 min-w-0 text-left active:opacity-60 transition-opacity"
      >
        {renderValue
          ? renderValue(value)
          : (
            <span className="text-[14px]" style={{ color: value ? '#ffffff' : '#6B6360' }}>
              {value || placeholder || '—'}
            </span>
          )}
      </button>

      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label="Редактировать"
        className="shrink-0 p-1 active:opacity-60 transition-opacity"
      >
        <Pencil size={pencilSize} strokeWidth={2.2} style={{ color: '#D99962' }} />
      </button>
    </div>
  );
}
