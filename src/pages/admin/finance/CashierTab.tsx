import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Download, X } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFinance } from '../../../context/FinanceContext';
import { exportToCSV } from '../../../lib/exportToCSV';
import { datesInPeriod, isInPeriod, sameDay, type FinancePeriod } from '../../../lib/financePeriod';
import { playerNickname } from '../../../lib/playerName';
import { TRANSACTION_TYPE_LABEL } from '../../../types/finance';
import { DebtorsTab } from './DebtorsTab';

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
  const [showDebtors, setShowDebtors] = useState(false);
  const [showRevenue, setShowRevenue] = useState(false);

  const filtered = useMemo(
    () => transactions.filter((tx) => isInPeriod(tx.date, period)),
    [transactions, period],
  );

  const paid = useMemo(
    () => filtered.filter((tx) => tx.status === 'paid'),
    [filtered],
  );

  const revenue = paid.reduce((sum, tx) => sum + tx.amount, 0);
  const expected = filtered
    .filter((tx) => tx.status === 'unpaid')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const tickets = filtered.filter((tx) => tx.type === 'ticket').length;

  const chartData = useMemo(
    () =>
      datesInPeriod(period).map((day) => ({
        label: day.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
        amount: paid
          .filter((tx) => sameDay(tx.date, day))
          .reduce((sum, tx) => sum + tx.amount, 0),
      })),
    [paid, period],
  );

  if (showDebtors) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowDebtors(false)}
          className="flex items-center gap-2 text-[13px] font-700"
          style={{ color: '#D99962' }}
        >
          <ArrowLeft size={16} />
          Назад к кассе
        </button>
        <DebtorsTab />
      </div>
    );
  }

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

      <button
        type="button"
        onClick={() => setShowDebtors(true)}
        className="w-full py-4 rounded-xl text-[16px] font-800 tracking-wide active:scale-[0.98] transition-transform"
        style={{
          background: 'linear-gradient(to right, #7f1d1d, #ef4444)',
          color: '#fff',
          boxShadow: '0 0 18px rgba(239,68,68,0.32)',
        }}
      >
        Должники
      </button>

      <div className="grid grid-cols-1 gap-3">
        <button type="button" onClick={() => setShowRevenue(true)} className="text-left">
          <MetricCard label="Выручка" value={formatRub(revenue)} accent="#F2D8A7" clickable />
        </button>
        <MetricCard label="Ожидается" value={formatRub(expected)} accent="#f87171" />
        <MetricCard label="Выдано билетов" value={String(tickets)} accent="#D99962" />
      </div>

      <div
        className="rounded-2xl px-2 py-4"
        style={{ background: '#2A211D', border: '1px solid rgba(217,153,98,0.22)' }}
      >
        <p className="px-3 text-[11px] font-700 uppercase tracking-[0.16em] mb-2" style={{ color: '#8c8c88' }}>
          Выручка по дням
        </p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D99962" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#D99962" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#8c8c88', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                interval={chartData.length > 10 ? 4 : 0}
              />
              <YAxis
                tick={{ fill: '#8c8c88', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v: number) => (v === 0 ? '0' : `${Math.round(v / 1000)}k`)}
              />
              <Tooltip
                contentStyle={{
                  background: '#231A16',
                  border: '1px solid rgba(217,153,98,0.35)',
                  borderRadius: 12,
                  color: '#F2D8A7',
                  fontSize: 12,
                }}
                formatter={(value) => [formatRub(Number(value ?? 0)), 'Оплачено']}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#D99962"
                fill="url(#revenueFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
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

      {showRevenue &&
        createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Закрыть"
            onClick={() => setShowRevenue(false)}
          />
          <div
            className="relative w-full max-w-[480px] max-h-[75vh] rounded-t-3xl px-4 pt-4 pb-8 overflow-y-auto"
            style={{ background: '#1A1411', border: '1px solid rgba(217,153,98,0.28)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-800 uppercase tracking-wide text-white">
                Оплаченные транзакции
              </h2>
              <button
                type="button"
                onClick={() => setShowRevenue(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.06)' }}
                aria-label="Закрыть"
              >
                <X size={16} style={{ color: '#A39B98' }} />
              </button>
            </div>
            {paid.length === 0 ? (
              <p className="text-center text-[13px] py-8" style={{ color: '#6B6360' }}>
                Нет оплаченных транзакций за период
              </p>
            ) : (
              <div className="space-y-2">
                {paid.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-3"
                    style={{ background: '#2A211D' }}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-700 text-white truncate">
                        {playerNickname(tx.userId)}
                      </p>
                      <p className="text-[11px]" style={{ color: '#A39B98' }}>
                        {TRANSACTION_TYPE_LABEL[tx.type]}
                      </p>
                    </div>
                    <p className="text-[14px] font-800 shrink-0" style={{ color: '#F2D8A7' }}>
                      {formatRub(tx.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
  clickable,
}: {
  label: string;
  value: string;
  accent: string;
  clickable?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-5 py-4 ${clickable ? 'active:scale-[0.99] transition-transform' : ''}`}
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
