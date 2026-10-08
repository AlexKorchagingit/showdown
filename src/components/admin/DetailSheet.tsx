import type { ReactNode } from 'react';
import { X } from 'lucide-react';

/** Full-screen list that opens over an admin screen and closes back to it. */
export function DetailSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-[90] flex flex-col bg-[#110b09]">
      <div className="flex-shrink-0 flex items-center gap-3 px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: 'rgba(28,20,16,0.78)',
            border: '1px solid rgba(217,153,98,0.28)',
          }}
          aria-label="Назад"
        >
          <X size={18} strokeWidth={2.2} style={{ color: '#D99962' }} />
        </button>
        <h3 className="text-[15px] font-800 text-white truncate">{title}</h3>
      </div>
      <div
        className="flex-1 scrollable px-4 pt-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >
        {children}
      </div>
    </div>
  );
}
