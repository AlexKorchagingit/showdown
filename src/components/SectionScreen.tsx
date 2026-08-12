import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  backTo: string;
  children?: ReactNode;
  contentPaddingBottom?: string;
}

/** Full-screen shell with a back button and a centered title. */
export function SectionScreen({ title, backTo, children, contentPaddingBottom }: Props) {
  const navigate = useNavigate();

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <button
        type="button"
        onClick={() => navigate(backTo)}
        className="absolute top-4 left-4 z-50 w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(28,20,16,0.78)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(217,153,98,0.28)',
        }}
        aria-label="Назад"
      >
        <ArrowLeft size={22} strokeWidth={2.2} style={{ color: '#D99962' }} />
      </button>

      <div className="flex-shrink-0 px-5 pt-20 pb-4">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase">
          {title}
        </h1>
      </div>

      <div
        className="flex-1 scrollable px-5"
        style={{
          paddingBottom:
            contentPaddingBottom ?? 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
        }}
      >
        {children ?? (
          <p className="text-center text-[13px] font-500 pt-8" style={{ color: '#6B6360' }}>
            Раздел находится в разработке
          </p>
        )}
      </div>
    </div>
  );
}
