import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  backTo?: string;
  onBack?: () => void;
  right?: ReactNode;
  children?: ReactNode;
}

const BACK_BTN =
  'w-10 h-10 rounded-full flex items-center justify-center shrink-0';

/** Compact one-row header: back + title (+ optional right slot / tabs). */
export function CompactHeader({ title, backTo, onBack, right, children }: Props) {
  const navigate = useNavigate();

  return (
    <div className="flex-shrink-0 px-3 py-2 space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (onBack) onBack();
            else if (backTo) navigate(backTo);
          }}
          className={BACK_BTN}
          style={{
            background: 'rgba(28,20,16,0.78)',
            border: '1px solid rgba(217,153,98,0.28)',
          }}
          aria-label="Назад"
        >
          <ArrowLeft size={20} strokeWidth={2.2} style={{ color: '#D99962' }} />
        </button>
        <h1 className="flex-1 min-w-0 text-[14px] font-800 tracking-[0.16em] text-white uppercase truncate">
          {title}
        </h1>
        {right}
      </div>
      {children}
    </div>
  );
}
