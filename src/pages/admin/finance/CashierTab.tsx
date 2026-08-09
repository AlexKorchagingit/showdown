import { useMemo, useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { useFinance } from '../../../context/FinanceContext';
import { exportToCSV } from '../../../lib/exportToCSV';
import { isInPeriod, type FinancePeriod } from '../../../lib/financePeriod';

const PERIODS: { id: FinancePeriod; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
];

function formatRub(value: number): string {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

export function CashierTab() {
  const { transactions } = useFinance();
  const [period, setPeriod] = useState<FinancePeriod>('week');

  const filtered = useMemo(
    () => transactions.filter((tx) => isInPeriod(tx.date, period)),
    [transactions, period],
  );

  const revenue = filtered
    .filter((tx) => tx.status === 'paid')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const expected = filtered
    .filter((tx) => tx.status === 'unpaid')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const tickets = filtered.filter((tx) => tx.type === 'ticket').length;

  return (
    <div className="space-y-5">
      <div className="flex rounded-xl p-1" style={{ background: '#1E1612' }}>
        {PERIODS.map(({ id, label }) => {
          const active = period === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPeriod(id)}
              className="flex-1 py-2.5 rounded-lg text-[12px] font-700 transition-colors"
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

      <div className="grid grid-cols-1 gap-3">
        <MetricCard label="Выручка" value={formatRub(revenue)} accent="#F2D8A7" />
        <MetricCard label="Ожидается" value={formatRub(expected)} accent="#f87171" />
        <MetricCard label="Выдано билетов" value={String(tickets)} accent="#D99962" />
      </div>

      <div
        className="rounded-2xl px-5 py-10 flex flex-col items-center justify-center gap-3"
        style={{ background: '#2A211D', border: '1px dashed rgba(217,153,98,0.35)' }}
      >
        <BarChart3 size={28} style={{ color: '#D99962' }} />
        <p className="text-[13px] font-600 text-center" style={{ color: '#A39B98' }}>
          Здесь будет график по дням
        </p>
        <p className="text-[11px] text-center" style={{ color: '#6B6360' }}>
          Заглушка дашборда кассы
        </p>
      </div>

      <button
        type="button"
        onClick={() => exportToCSV(filtered)}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-700 text-[#0A0908] active:scale-[0.98] transition-transform"
        style={{
          background: 'linear-gradient(to right, #8C4C27, #D99962)',
          boxShadow: '0 0 16px rgba(217,153,98,0.28)',
        }}
      >
        <Download size={17} strokeWidth={2.4} />
        Экспорт в Excel (CSV)
      </button>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <p className="text-[11px] font-700 uppercase tracking-[0.16em]" style={{ color: '#8c8c88' }}>
        {label}
      </p>
      <p className="text-[28px] font-900 tracking-wide mt-1 leading-none" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}
