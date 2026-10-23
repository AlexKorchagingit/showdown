import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { BlindStructure } from '../data/blindStructures';
import { lateRegEndClock, structurePreviewRows } from '../lib/structurePreview';

export function BlindStructureModal({
  structure,
  fallbackName,
  startTime,
  lateRegUntil,
  pending = false,
  onClose,
}: {
  structure: BlindStructure | null;
  fallbackName: string;
  startTime: string;
  lateRegUntil: string;
  pending?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = structurePreviewRows(structure);
  const title = structure?.name?.trim() || fallbackName || 'Структура';
  const lateRegClock = lateRegEndClock(startTime, structure?.levels) || lateRegUntil.trim();

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3"
      style={{ background: 'rgba(8,6,5,0.72)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md max-h-[78vh] overflow-hidden rounded-2xl flex flex-col"
        style={{ background: '#1A1411', border: '1px solid rgba(242,216,167,0.28)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-700 uppercase tracking-[0.14em]" style={{ color: '#A39B98' }}>
              Структура турнира
            </p>
            <h2 className="text-[16px] font-800 text-white truncate">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть структуру"
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <X size={16} style={{ color: '#F2D8A7' }} />
          </button>
        </div>
        <div className="overflow-y-auto px-3 py-2">
          <p className="px-1 py-2 text-[13px] font-800" style={{ color: '#F2D8A7' }}>
            {lateRegClock
              ? `Конец поздней регистрации — ${lateRegClock}`
              : 'Конец поздней регистрации не задан'}
          </p>
          {rows.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px]" style={{ color: '#A39B98' }}>
              {pending ? 'Загрузка структуры…' : 'Структура ещё не загружена'}
            </p>
          ) : (
            <ul>
              {rows.map((row) => (
                <li
                  key={row.key}
                  className="flex items-baseline gap-2 px-1 py-1.5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <span
                    className="w-16 shrink-0 text-[11px] font-800"
                    style={{ color: row.break ? '#D99962' : '#F2D8A7' }}
                  >
                    {row.label}
                  </span>
                  <span className={`min-w-0 flex-1 text-[12px] font-600 text-white ${row.lateRegEnd ? '' : 'truncate'}`}>
                    {row.detail || '—'}
                  </span>
                  <span className="shrink-0 text-[11px] font-700" style={{ color: '#A39B98' }}>
                    {row.minutes}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
