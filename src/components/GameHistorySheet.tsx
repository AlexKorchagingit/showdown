import { Gem, X } from 'lucide-react';
import type { PlayerGameHistoryRow } from '../lib/playerAnalytics';

interface GameHistorySheetProps {
  rows: PlayerGameHistoryRow[];
  onClose: () => void;
}

export function GameHistorySheet({ rows, onClose }: GameHistorySheetProps) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/65"
        aria-label="Закрыть историю игр"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[82vh] w-full max-w-lg flex-col rounded-t-3xl px-4 pt-4"
        style={{
          background: '#1A1411',
          border: '1px solid rgba(217,153,98,0.28)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-800 uppercase tracking-wide text-white">История игр</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)' }}
            aria-label="Закрыть"
          >
            <X size={16} className="text-[#A39B98]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="px-1 py-10 text-center text-[13px] text-[#6B6360]">
              Пока нет завершённых турниров
            </p>
          ) : (
            <div className="space-y-2 pb-2">
              {rows.map((row) => (
                <article
                  key={row.id}
                  className="rounded-xl px-3 py-3"
                  style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <p className="text-[11px] font-600 tabular-nums text-[#8c8c88]">{row.date}</p>
                  <p className="mt-0.5 text-[14px] font-800 leading-snug text-white">{row.title}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-600 text-[#A39B98]">
                    <span>Игроков: {row.field}</span>
                    <span>
                      Место:{' '}
                      <span className="text-[#D99962]">{row.place ?? '—'}</span>
                    </span>
                    {row.knockouts > 0 ? <span>Нокауты: {row.knockouts}</span> : null}
                    {row.ratingAwarded > 0 ? (
                      <span>
                        Рейтинг:{' '}
                        <span className="text-[#D99962]">+{row.ratingAwarded.toLocaleString('ru-RU')}</span>
                      </span>
                    ) : null}
                    {row.rubiesAwarded > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Gem size={12} strokeWidth={2.4} className="text-rose-500" />
                        <span>
                          Рубины:{' '}
                          <span className="text-[#fb7185]">+{row.rubiesAwarded.toLocaleString('ru-RU')}</span>
                        </span>
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
