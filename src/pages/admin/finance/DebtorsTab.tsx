import { Check } from 'lucide-react';
import { useFinance } from '../../../context/FinanceContext';
import { useTournaments } from '../../../context/TournamentContext';
import { playerNickname } from '../../../lib/playerName';
import { TRANSACTION_TYPE_LABEL } from '../../../types/finance';

export function DebtorsTab() {
  const { transactions, markPaid } = useFinance();
  const { tournaments } = useTournaments();

  const unpaid = [...transactions]
    .filter((tx) => tx.status === 'unpaid')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const tournamentTitle = (id: string) =>
    tournaments.find((t) => t.id === id)?.title ?? id;

  if (unpaid.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <p className="text-[13px] font-500" style={{ color: '#6B6360' }}>
          Должников нет
        </p>
        <p className="text-[11px] text-center px-6" style={{ color: '#69584f' }}>
          Все транзакции оплачены
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {unpaid.map((tx) => (
        <div
          key={tx.id}
          className="rounded-2xl p-4 space-y-3"
          style={{ background: '#2A211D', border: '1px solid rgba(239,68,68,0.28)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-700 text-white truncate">{playerNickname(tx.userId)}</p>
              <p className="text-[12px] mt-0.5" style={{ color: '#D99962' }}>
                {tournamentTitle(tx.tournamentId)}
              </p>
              <p className="text-[12px] mt-1" style={{ color: '#A39B98' }}>
                {TRANSACTION_TYPE_LABEL[tx.type]}
                {tx.comment ? ` · ${tx.comment}` : ''}
              </p>
            </div>
            <p className="text-[16px] font-900 shrink-0" style={{ color: '#f87171' }}>
              {tx.amount.toLocaleString('ru-RU')} ₽
            </p>
          </div>

          <button
            type="button"
            onClick={() => markPaid([tx.id])}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-700 text-[#0A0908] active:scale-[0.98] transition-transform"
            style={{ background: 'linear-gradient(to right, #166534, #22c55e)' }}
          >
            <Check size={17} strokeWidth={2.6} />
            Погасить долг
          </button>
        </div>
      ))}
    </div>
  );
}
