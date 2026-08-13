import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  backTo?: string;
  onBack?: () => void;
  right?: ReactNode;
  children?: ReactNode;
  centerTitle?: boolean;
  className?: string;
}

const BACK_BTN =
  'w-10 h-10 rounded-full flex items-center justify-center shrink-0';

/** Compact one-row header: back + title (+ optional right slot / tabs). */
export function CompactHeader({
  title,
  backTo,
  onBack,
  right,
  children,
  centerTitle = false,
  className,
}: Props) {
  const navigate = useNavigate();

  return (
    <div className={`flex-shrink-0 px-3 space-y-2 ${className ?? 'py-2'}`}>
      <div className={`relative flex items-center gap-2 ${centerTitle ? 'justify-between' : ''}`}>
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
        <h1
          className={
            centerTitle
              ? 'absolute left-1/2 -translate-x-1/2 text-[15px] font-800 tracking-[0.18em] text-white uppercase pointer-events-none text-center leading-tight'
              : 'flex-1 min-w-0 text-[13px] font-800 tracking-[0.12em] text-white uppercase leading-tight'
          }
        >
          {title}
        </h1>
        {right ? <div className={centerTitle ? 'ml-auto shrink-0' : 'shrink-0'}>{right}</div> : null}
      </div>
      {children}
    </div>
  );
}
