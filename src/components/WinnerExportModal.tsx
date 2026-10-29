import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { formatWinnerPoints, winnerExportText, type WinnerExportRow } from '../lib/winnerExport';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Telegram's webview often blocks the async clipboard. The selection fallback is next.
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

export function WinnerExportModal({
  title,
  rows,
  onClose,
}: {
  title: string;
  rows: readonly WinnerExportRow[];
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const timer = useRef<number | null>(null);
  const text = winnerExportText(rows);

  useEffect(() => () => {
    if (timer.current != null) window.clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    const ok = await copyText(text);
    setNote(ok ? 'Скопировано' : 'Не удалось скопировать');
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNote(''), 1600);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(8,6,5,0.72)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Список участников"
        className="flex max-h-[82vh] w-full max-w-sm flex-col rounded-2xl"
        style={{ background: '#1A1411', border: '1px solid rgba(242,216,167,0.28)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-800 text-white">Участники</h2>
            <p className="mt-0.5 truncate text-[12px] font-600" style={{ color: '#D99962' }}>{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)' }}
            aria-label="Закрыть"
          >
            <X size={15} className="text-[#A39B98]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-[13px]" style={{ color: '#6B6360' }}>
              В списке никого нет
            </p>
          ) : (
            <ol className="space-y-2">
              {rows.map((row, index) => (
                <li
                  key={`${row.place ?? 'x'}-${row.nickname}-${index}`}
                  className="flex items-baseline justify-between gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: '#2A211D' }}
                >
                  <p className="min-w-0 truncate text-[13px] font-700 text-white">
                    <span className="tabular-nums" style={{ color: '#D99962' }}>
                      {row.place ?? index + 1}.
                    </span>{' '}
                    {row.nickname}
                  </p>
                  <p className="shrink-0 text-[13px] font-800 tabular-nums text-white">
                    {formatWinnerPoints(row.points)}
                    {row.knockoutPoints > 0 ? (
                      <span className="ml-1.5" style={{ color: '#86efac' }}>
                        +{formatWinnerPoints(row.knockoutPoints)}
                      </span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="px-4 pb-4 pt-1">
          <button
            type="button"
            onClick={() => void copy()}
            disabled={rows.length === 0}
            className="w-full py-3 rounded-xl text-[14px] font-800 text-[#0A0908] active:scale-[0.98] disabled:opacity-40"
            style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
          >
            Скопировать
          </button>
          {note ? (
            <p className="mt-2 text-center text-[12px] font-700" style={{ color: note === 'Скопировано' ? '#86efac' : '#f87171' }}>
              {note}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
