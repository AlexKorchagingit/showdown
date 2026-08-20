import { clubLegalPageFiles, type ClubLegalDocument } from '../data/legalDocuments';
import { asset } from '../lib/assets';
import { X } from 'lucide-react';

interface LegalImageModalProps {
  document: ClubLegalDocument;
  onClose: () => void;
}

export function LegalImageModal({ document, onClose }: LegalImageModalProps) {
  const pages = clubLegalPageFiles(document);

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
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          {pages.map((page, index) => (
            <img
              key={page}
              src={asset(page)}
              alt={`${document.title}, стр. ${index + 1}`}
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
              onDragStart={(event) => event.preventDefault()}
              className="pointer-events-none w-full select-none bg-white object-contain shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
