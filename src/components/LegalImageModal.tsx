import { useState } from 'react';
import { X } from 'lucide-react';
import type { ClubLegalDocument } from '../data/legalDocuments';
import { asset } from '../lib/assets';

interface LegalImageModalProps {
  document: ClubLegalDocument;
  onClose: () => void;
}

export function LegalImageModal({ document, onClose }: LegalImageModalProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#0A0908]">
      <header className="flex shrink-0 items-start gap-3 px-4 py-3">
        <h2 className="min-w-0 flex-1 pt-1 text-[15px] font-800 leading-snug text-white">
          {document.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{
            background: 'rgba(28,20,16,0.78)',
            border: '1px solid rgba(217,153,98,0.28)',
          }}
          aria-label="Закрыть"
        >
          <X size={18} strokeWidth={2.2} className="text-[#D99962]" />
        </button>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-6"
        onContextMenu={(event) => event.preventDefault()}
      >
        {failed ? (
          <p className="px-2 pt-10 text-center text-[13px] leading-relaxed text-[#8c8c88]">
            Документ ещё не загружен. Положите файл
            <span className="mt-1 block font-700 text-[#D99962]">public/legal/{document.file}</span>
          </p>
        ) : (
          <img
            src={asset(`/legal/${document.file}`)}
            alt={document.title}
            draggable={false}
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
            onError={() => setFailed(true)}
            className="pointer-events-none mx-auto w-full max-w-3xl select-none object-contain"
          />
        )}
      </div>
    </div>
  );
}
