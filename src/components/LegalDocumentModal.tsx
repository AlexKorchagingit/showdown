import { X } from 'lucide-react';
import type { LegalDocument } from '../data/legalDocuments';

interface LegalDocumentModalProps {
  document: LegalDocument;
  onClose: () => void;
}

export function LegalDocumentModal({ document, onClose }: LegalDocumentModalProps) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-md overflow-hidden rounded-2xl border border-[#E8C547]/25 bg-[#231A16] shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-[#E8C547]/15 px-4 py-3">
          <h2 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-[#F4E4BC]">
            {document.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#F4E4BC]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[62vh] overflow-y-auto px-4 py-4">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#F4E4BC]/85">{document.body}</p>
        </div>
        <div className="border-t border-[#E8C547]/15 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-xl bg-gradient-to-b from-[#E8C547] to-[#C9A227] text-[13px] font-semibold text-[#231A16]"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
