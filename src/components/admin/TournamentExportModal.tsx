import { useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import type { Tournament } from '../../types/tournament';
import { exportTournamentsToCSV, tournamentExportFilename } from '../../lib/exportToCSV';
import { formatIsoDay, startOfDay } from '../../lib/financePeriod';
import { filterTournamentsByStartDate, statsPeriodBounds } from '../../lib/statsPeriod';

type ExportPresetId = 'today' | 'week' | 'month' | 'all';
type ExportPreset = ExportPresetId | 'custom';

const EXPORT_PRESETS: { id: ExportPresetId; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'all', label: 'Все время' },
];

const FIELD_CLASS =
  'w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#D99962]/60';
const LABEL_CLASS = 'block text-[11px] font-700 uppercase tracking-[0.18em] mb-2 text-[#D99962]';

function initialMonthRange(now = new Date()): { from: string; to: string } {
  const bounds = statsPeriodBounds('month', now);
  if (!bounds) return { from: '', to: '' };
  return { from: formatIsoDay(bounds.start), to: formatIsoDay(bounds.end) };
}

export function TournamentExportModal({
  tournaments,
  onClose,
}: {
  tournaments: Tournament[];
  onClose: () => void;
}) {
  const month = initialMonthRange();
  const [preset, setPreset] = useState<ExportPreset>('month');
  const [fromDate, setFromDate] = useState(month.from);
  const [toDate, setToDate] = useState(month.to);

  const applyPreset = (next: ExportPresetId) => {
    setPreset(next);
    const now = new Date();
    if (next === 'all') {
      setFromDate('');
      setToDate('');
      return;
    }
    if (next === 'today') {
      const day = formatIsoDay(startOfDay(now));
      setFromDate(day);
      setToDate(day);
      return;
    }
    const bounds = statsPeriodBounds(next, now);
    if (!bounds) return;
    setFromDate(formatIsoDay(bounds.start));
    setToDate(formatIsoDay(bounds.end));
  };

  const exportRows = useMemo(
    () => filterTournamentsByStartDate(tournaments, fromDate, toDate),
    [tournaments, fromDate, toDate],
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3"
      style={{ background: 'rgba(8,6,5,0.72)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Выгрузка в Excel"
        className="w-full max-w-md rounded-2xl p-4 space-y-3"
        style={{ background: '#1A1411', border: '1px solid rgba(242,216,167,0.28)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <h2 className="flex-1 text-[16px] font-800 text-white">Выгрузка в Excel</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть выгрузку"
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <X size={16} style={{ color: '#F2D8A7' }} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-xl p-1" style={{ background: '#1E1612' }}>
          {EXPORT_PRESETS.map(({ id, label }) => {
            const active = preset === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => applyPreset(id)}
                className="py-2.5 rounded-lg text-[11px] font-700 leading-tight"
                style={{
                  background: active ? 'linear-gradient(to right, #8C4C27, #D99962)' : 'transparent',
                  color: active ? '#0A0908' : '#6B6360',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <section>
            <label className={LABEL_CLASS}>С</label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setPreset('custom');
                setFromDate(event.target.value);
              }}
              className={`${FIELD_CLASS} [color-scheme:dark]`}
            />
          </section>
          <section>
            <label className={LABEL_CLASS}>По</label>
            <input
              type="date"
              value={toDate}
              onChange={(event) => {
                setPreset('custom');
                setToDate(event.target.value);
              }}
              className={`${FIELD_CLASS} [color-scheme:dark]`}
            />
          </section>
        </div>
        <button
          type="button"
          disabled={exportRows.length === 0}
          onClick={() => {
            exportTournamentsToCSV(exportRows, tournamentExportFilename(fromDate, toDate));
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-700 text-[#0A0908] active:scale-[0.98] disabled:opacity-40"
          style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
        >
          <Download size={17} strokeWidth={2.4} />
          Экспорт в Excel (CSV)
        </button>
        <p className="text-[12px]" style={{ color: '#8c8c88' }}>
          {exportRows.length === 0
            ? 'Нет турниров за выбранный период'
            : `К выгрузке: ${exportRows.length}`}
        </p>
      </div>
    </div>
  );
}
