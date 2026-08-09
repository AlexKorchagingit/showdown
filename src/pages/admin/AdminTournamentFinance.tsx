import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { useTournaments } from '../../context/TournamentContext';
import { useFinance } from '../../context/FinanceContext';
import { DEFAULT_ENTRY_FEE, TRANSACTION_TYPE_LABEL } from '../../types/finance';
import type { TransactionType } from '../../types/finance';

const CHARGE_ACTIONS: { type: Exclude<TransactionType, 'ticket'>; label: string }[] = [
  { type: 'buy-in', label: 'Вход' },
  { type: 'rebuy', label: 'Ребай' },
  { type: 'addon', label: 'Аддон' },
];

export function AdminTournamentFinance() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tournaments } = useTournaments();
  const {
    addCharge,
    addTicket,
    getDealerHours,
    adjustDealerHours,
    unpaidForPlayer,
    unpaidTotalForPlayer,
    markPlayerPaid,
  } = useFinance();

  const tournament = tournaments.find((t) => t.id === id);
  if (!tournament) return <Navigate to="/admin/finance" replace />;

  const handleTicket = (userId: string, nickname: string) => {
    const reason = window.prompt(`Причина выдачи билета для ${nickname}?`, '');
    if (reason === null) return;
    addTicket(tournament.id, userId, reason.trim() || 'Билет');
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <button
        type="button"
        onClick={() => navigate('/admin/finance')}
        className="absolute top-4 left-4 z-50 w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(28,20,16,0.78)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(217,153,98,0.28)',
        }}
        aria-label="Назад"
      >
        <ArrowLeft size={22} strokeWidth={2.2} style={{ color: '#D99962' }} />
      </button>

      <div className="flex-shrink-0 px-5 pt-20 pb-3">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase mb-1">
          Касса турнира
        </h1>
        <p className="text-center text-[13px] font-600 uppercase tracking-wide" style={{ color: '#D99962' }}>
          {tournament.title}
        </p>
        <p className="text-center text-[11px] mt-1" style={{ color: '#8c8c88' }}>
          Стандартная сумма: {DEFAULT_ENTRY_FEE.toLocaleString('ru-RU')} ₽
        </p>
      </div>

      <div
        className="flex-1 scrollable px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        {tournament.participants.length === 0 ? (
          <p className="text-center text-[13px] pt-12" style={{ color: '#6B6360' }}>
            Участников нет
          </p>
        ) : (
          <div className="space-y-3">
            {tournament.participants.map((player) => {
              const unpaid = unpaidForPlayer(tournament.id, player.id);
              const unpaidTotal = unpaidTotalForPlayer(tournament.id, player.id);
              const hours = getDealerHours(tournament.id, player.id);
              const hasDebt = unpaid.length > 0;

              return (
                <div
                  key={player.id}
                  className="rounded-2xl p-4 space-y-3"
                  style={{
                    background: '#2A211D',
                    border: hasDebt
                      ? '1px solid rgba(239,68,68,0.45)'
                      : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-700 shrink-0"
                      style={{ background: 'rgba(140,76,39,0.28)', color: '#c8a38e' }}
                    >
                      {player.nickname[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-700 text-white truncate">{player.nickname}</p>
                        {hasDebt && (
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: '#ef4444', boxShadow: '0 0 8px #ef4444' }}
                            aria-label="Есть долг"
                          />
                        )}
                      </div>
                      {unpaid.length > 0 && (
                        <p className="text-[11px] mt-0.5" style={{ color: '#f87171' }}>
                          {unpaid
                            .map((tx) => TRANSACTION_TYPE_LABEL[tx.type])
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {CHARGE_ACTIONS.map(({ type, label }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => addCharge(tournament.id, player.id, type)}
                        className="py-2 rounded-lg text-[11px] font-700 active:scale-95 transition-transform"
                        style={{
                          background: 'rgba(217,153,98,0.12)',
                          border: '1px solid rgba(217,153,98,0.35)',
                          color: '#F2D8A7',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleTicket(player.id, player.nickname)}
                      className="py-2 rounded-lg text-[11px] font-700 active:scale-95 transition-transform"
                      style={{
                        background: 'rgba(34,197,94,0.12)',
                        border: '1px solid rgba(34,197,94,0.35)',
                        color: '#86efac',
                      }}
                    >
                      Билет
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-600" style={{ color: '#8c8c88' }}>
                      Дилер-часы:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => adjustDealerHours(tournament.id, player.id, -0.5)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                        aria-label="Минус полчаса"
                      >
                        <Minus size={14} style={{ color: '#A39B98' }} />
                      </button>
                      <span className="text-[14px] font-800 w-10 text-center text-white">
                        {hours}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustDealerHours(tournament.id, player.id, 0.5)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                        aria-label="Плюс полчаса"
                      >
                        <Plus size={14} style={{ color: '#A39B98' }} />
                      </button>
                    </div>
                  </div>

                  {hasDebt && unpaidTotal > 0 && (
                    <button
                      type="button"
                      onClick={() => markPlayerPaid(tournament.id, player.id)}
                      className="w-full py-3 rounded-xl text-[13px] font-800 active:scale-[0.98] transition-transform"
                      style={{
                        background: 'linear-gradient(to right, #7f1d1d, #ef4444)',
                        color: '#fff',
                      }}
                    >
                      Оплатить {unpaidTotal.toLocaleString('ru-RU')} руб
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
