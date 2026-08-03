import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface Props {
  title: string;
  backTo: string;
}

export function AdminSectionScreen({ title, backTo }: Props) {
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
      >
        <ArrowLeft size={22} strokeWidth={2.2} style={{ color: '#D99962' }} />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-[15px] font-800 tracking-[0.2em] text-white uppercase mb-3">
          {title}
        </h1>
        <p className="text-[13px] font-500" style={{ color: '#6B6360' }}>
          Раздел находится в разработке
        </p>
      </div>
    </div>
  );
}
