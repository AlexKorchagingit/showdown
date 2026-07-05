import { Mail } from 'lucide-react';

interface Props {
  userEmail: string;
}

export function ProfilePage({ userEmail }: Props) {
  return (
    <div className="flex flex-col h-full bg-[#110b09]">
      <div className="flex-shrink-0 px-5 pt-6 pb-4">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase">
          ПРОФИЛЬ
        </h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
          style={{
            background: 'rgba(140,76,39,0.2)',
            border: '1px solid rgba(217,153,98,0.3)',
          }}
        >
          <Mail size={28} style={{ color: '#D99962' }} />
        </div>

        <p className="text-[12px] font-600 uppercase tracking-[0.2em] mb-3" style={{ color: '#A39B98' }}>
          Email
        </p>

        <p
          className="text-center text-[20px] font-700 text-white break-all leading-snug max-w-full"
          style={{ color: '#F2D8A7' }}
        >
          {userEmail || '—'}
        </p>
      </div>
    </div>
  );
}
