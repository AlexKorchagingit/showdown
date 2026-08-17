import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Download, X } from 'lucide-react';
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
import { useTournaments } from '../../../context/TournamentContext';
import { exportToCSV } from '../../../lib/exportToCSV';
import { datesInPeriod, isInPeriod, sameDay, type FinancePeriod } from '../../../lib/financePeriod';
import { playerNickname } from '../../../lib/playerName';
import { formatTxDate, formatTxTime, ledgerTimestamp } from '../../../lib/transactionDisplay';
import {
  TRANSACTION_STATUS_LABEL,
  TRANSACTION_TYPE_LABEL,
  type Transaction,
} from '../../../types/finance';

const PERIODS: { id: FinancePeriod; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
];

type SheetKind = 'revenue' | 'expected' | 'tickets';

const SHEET_TITLE: Record<SheetKind, string> = {
  revenue: 'Оплаченные транзакции',
  expected: 'Долги',
  tickets: 'Выданные билеты',
};

function formatRub(value: number): string {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

function newestFirst(a: Transaction, b: Transaction): number {
  return new Date(ledgerTimestamp(b)).getTime() - new Date(ledgerTimestamp(a)).getTime();
}

export function CashierTab() {
  const { transactions, markPaid } = useFinance();
  const { tournaments } = useTournaments();
  const [period, setPeriod] = useState<FinancePeriod>('today');
  const [sheet, setSheet] = useState<SheetKind | null>(null);

  const tournamentTitle = (id: string) => tournaments.find((t) => t.id === id)?.title ?? id;

  const filtered = useMemo(
    () =>
      transactions
        .filter((tx) => isInPeriod(ledgerTimestamp(tx), period))
        .slice()
        .sort(newestFirst),
    [transactions, period],
  );

  const paid = useMemo(
    () => filtered.filter((tx) => tx.status === 'paid'),
    [filtered],
  );

  const allUnpaid = useMemo(
    () => transactions.filter((tx) => tx.status === 'unpaid').slice().sort(newestFirst),
    [transactions],
  );

  const tickets = useMemo(
    () => filtered.filter((tx) => tx.type === 'ticket'),
    [filtered],
  );

  const revenue = paid.reduce((sum, tx) => sum + tx.amount, 0);
  const expected = allUnpaid.reduce((sum, tx) => sum + tx.amount, 0);

  const chartData = useMemo(
    () =>
      datesInPeriod(period).map((day) => ({
        label: day.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
        amount: paid
          .filter((tx) => sameDay(ledgerTimestamp(tx), day))
          .reduce((sum, tx) => sum + tx.amount, 0),
      })),
    [paid, period],
  );

  const sheetItems = sheet === 'revenue' ? paid : sheet === 'expected' ? allUnpaid : tickets;
  const emptyCopy =
    sheet === 'revenue'
      ? 'Нет оплаченных транзакций за период'
      : sheet === 'expected'
        ? 'Долгов нет'
        : 'Нет выданных билетов за период';

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
        <button type="button" onClick={() => setSheet('revenue')} className="text-left">
          <MetricCard label="Выручка" value={formatRub(revenue)} accent="#F2D8A7" />
        </button>
        <button type="button" onClick={() => setSheet('expected')} className="text-left">
          <MetricCard label="Ожидается" value={formatRub(expected)} accent="#f87171" />
        </button>
        <button type="button" onClick={() => setSheet('tickets')} className="text-left">
          <MetricCard label="Билеты" value={String(tickets.length)} accent="#D99962" />
        </button>
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

      <div>
        <p className="text-[11px] font-700 uppercase tracking-[0.16em]" style={{ color: '#8c8c88' }}>
          Операции за период
        </p>
        <button
          type="button"
          onClick={() =>
            exportToCSV(filtered, {
              tournamentTitle,
              playerName: playerNickname,
            })
          }
          className="my-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-700 text-[#0A0908] active:scale-[0.98] transition-transform"
          style={{
            background: 'linear-gradient(to right, #8C4C27, #D99962)',
            boxShadow: '0 0 16px rgba(217,153,98,0.28)',
          }}
        >
          <Download size={17} strokeWidth={2.4} />
          Экспорт в Excel (CSV)
        </button>
        {filtered.length === 0 ? (
          <p className="text-center text-[13px] py-6" style={{ color: '#6B6360' }}>
            Нет операций за выбранный период
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((tx) => (
              <TransactionCard
                key={tx.id}
                tx={tx}
                tournamentTitle={tournamentTitle(tx.tournamentId)}
              />
            ))}
          </div>
        )}
      </div>

      {sheet &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-end justify-center">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              aria-label="Закрыть"
              onClick={() => setSheet(null)}
            />
            <div
              className="relative w-full max-w-[480px] max-h-[75vh] rounded-t-3xl px-4 pt-4 pb-8 overflow-y-auto"
              style={{ background: '#1A1411', border: '1px solid rgba(217,153,98,0.28)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-800 uppercase tracking-wide text-white">
                  {SHEET_TITLE[sheet]}
                </h2>
                <button
                  type="button"
                  onClick={() => setSheet(null)}
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                  aria-label="Закрыть"
                >
                  <X size={16} style={{ color: '#A39B98' }} />
                </button>
              </div>
              {sheetItems.length === 0 ? (
                <p className="text-center text-[13px] py-8" style={{ color: '#6B6360' }}>
                  {emptyCopy}
                </p>
              ) : (
                <div className="space-y-2">
                  {sheetItems.map((tx) => (
                    <TransactionCard
                      key={tx.id}
                      tx={tx}
                      tournamentTitle={tournamentTitle(tx.tournamentId)}
                      onSettle={sheet === 'expected' ? () => markPaid([tx.id]) : undefined}
                    />
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
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
      style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-700 uppercase tracking-[0.16em]" style={{ color: '#8c8c88' }}>
          {label}
        </p>
        <p className="text-[28px] font-900 tracking-wide mt-1 leading-none" style={{ color: accent }}>
          {value}
        </p>
      </div>
      <ChevronRight size={22} strokeWidth={2.2} className="shrink-0 opacity-50" style={{ color: '#F2D8A7' }} />
    </div>
  );
}

function TransactionCard({
  tx,
  tournamentTitle,
  onSettle,
}: {
  tx: Transaction;
  tournamentTitle: string;
  onSettle?: () => void;
}) {
  const amountColor = tx.status === 'unpaid' ? '#f87171' : '#F2D8A7';
  const stamp = ledgerTimestamp(tx);

  return (
    <div className="rounded-xl px-3 py-3 space-y-1.5" style={{ background: '#2A211D' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-700 text-white truncate">{playerNickname(tx.userId)}</p>
          <p className="text-[12px] mt-0.5 truncate" style={{ color: '#D99962' }}>
            {tournamentTitle}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[13px] font-800" style={{ color: amountColor }}>
            {TRANSACTION_TYPE_LABEL[tx.type]} · {formatRub(tx.amount)}
          </p>
          <p className="text-[10px] font-600 mt-0.5 uppercase tracking-wide" style={{ color: '#8c8c88' }}>
            {TRANSACTION_STATUS_LABEL[tx.status]}
          </p>
        </div>
      </div>
      <p className="text-[11px]" style={{ color: '#A39B98' }}>
        {formatTxDate(stamp)} · {formatTxTime(stamp)}
      </p>
      {tx.comment.trim() ? (
        <p className="text-[11px] leading-snug" style={{ color: '#c8a38e' }}>
          {tx.comment}
        </p>
      ) : null}
      {onSettle ? (
        <button
          type="button"
          onClick={onSettle}
          className="w-full mt-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-800 text-white bg-green-600 active:scale-[0.98] transition-transform"
        >
          <Check size={16} strokeWidth={2.6} />
          Погасить долг
        </button>
      ) : null}
    </div>
  );
}
