import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Search, X } from 'lucide-react';
import { useTournaments } from '../../context/TournamentContext';
import { useFinance } from '../../context/FinanceContext';
import { DEFAULT_ENTRY_FEE, TRANSACTION_TYPE_LABEL } from '../../types/finance';
import type { TransactionType } from '../../types/finance';
import { applyPlaceToParticipant } from '../../data/prizeStructure';
import { nextEliminatedPlace, sortFinancePlayers } from '../../lib/tournamentStatus';

const CHARGE_ACTIONS: { type: Exclude<TransactionType, 'ticket'>; label: string }[] = [
  { type: 'buy-in', label: 'Вход' },
  { type: 'rebuy', label: 'Ребай' },
  { type: 'addon', label: 'Аддон' },
];

export function AdminTournamentFinance() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tournaments, updateTournament } = useTournaments();
  const {
    addCharge,
    addTicket,
    getDealerHours,
    adjustDealerHours,
    unpaidForPlayer,
    unpaidTotalForPlayer,
    markPlayerPaid,
    removeTransaction,
  } = useFinance();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const tournament = tournaments.find((t) => t.id === id);

  const filtered = useMemo(() => {
    if (!tournament) return [];
    const q = query.trim().toLowerCase();
    const list = q
      ? tournament.participants.filter((p) => p.nickname.toLowerCase().includes(q))
      : tournament.participants;
    return sortFinancePlayers(list);
  }, [tournament, query]);

  if (!tournament) return <Navigate to="/admin/finance" replace />;

  const handleTicket = (userId: string, nickname: string) => {
    const reason = window.prompt(`Причина выдачи билета для ${nickname}?`, '');
    if (reason === null) return;
    addTicket(tournament.id, userId, reason.trim() || 'Билет');
  };

  const closeTournament = () => {
    if (tournament.isClosed) return;
    if (!window.confirm('Закрыть турнир? Он станет прошедшим, запись будет недоступна.')) return;
    updateTournament(tournament.id, { isClosed: true });
  };

  const eliminatePlayer = (playerId: string) => {
    const place = nextEliminatedPlace(tournament.participants);
    if (place == null) return;
    updateTournament(tournament.id, {
      participants: tournament.participants.map((p) =>
        p.id === playerId ? applyPlaceToParticipant(p, place, tournament.guarantee) : p,
      ),
    });
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

      <button
        type="button"
        onClick={() => {
          setSearchOpen((open) => !open);
          if (searchOpen) setQuery('');
        }}
        className="absolute top-4 right-4 z-50 w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(28,20,16,0.78)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(217,153,98,0.28)',
        }}
        aria-label="Поиск"
      >
        <Search size={20} strokeWidth={2.2} style={{ color: '#D99962' }} />
      </button>

      <div className="flex-shrink-0 px-5 pt-20 pb-3 space-y-3">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase mb-1">
          Касса турнира
        </h1>
        <p className="text-center text-[13px] font-600 uppercase tracking-wide" style={{ color: '#D99962' }}>
          {tournament.title}
        </p>
        <p className="text-center text-[11px]" style={{ color: '#8c8c88' }}>
          Стандартная сумма: {DEFAULT_ENTRY_FEE.toLocaleString('ru-RU')} ₽
        </p>

        {tournament.isClosed ? (
          <div
            className="w-full py-3.5 rounded-xl text-center text-[13px] font-800 tracking-wide"
            style={{
              background: 'rgba(81,79,76,0.85)',
              color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            ТУРНИР ЗАКРЫТ
          </div>
        ) : (
          <button
            type="button"
            onClick={closeTournament}
            className="w-full py-3.5 rounded-xl text-[14px] font-800 tracking-wide active:scale-[0.98] transition-transform"
            style={{
              background: 'linear-gradient(to right, #7f1d1d, #ef4444)',
              color: '#fff',
              boxShadow: '0 0 18px rgba(239,68,68,0.28)',
            }}
          >
            ЗАКРЫТЬ ТУРНИР
          </button>
        )}

        {searchOpen && (
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по нику…"
            className="w-full rounded-xl px-4 py-3 text-[14px] text-white outline-none"
            style={{
              background: '#231A16',
              border: '1px solid rgba(217,153,98,0.35)',
            }}
          />
        )}
      </div>

      <div
        className="flex-1 scrollable px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        {filtered.length === 0 ? (
          <p className="text-center text-[13px] pt-12" style={{ color: '#6B6360' }}>
            {tournament.participants.length === 0 ? 'Участников нет' : 'Никого не найдено'}
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((player) => {
              const unpaid = unpaidForPlayer(tournament.id, player.id);
              const unpaidTotal = unpaidTotalForPlayer(tournament.id, player.id);
              const hours = getDealerHours(tournament.id, player.id);
              const hasDebt = unpaid.length > 0;
              const eliminated = typeof player.place === 'number';

              return (
                <div
                  key={player.id}
                  className={`rounded-2xl p-4 space-y-3 ${eliminated ? 'opacity-50 grayscale' : ''}`}
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
                      {eliminated && (
                        <p className="text-[12px] font-800 mt-0.5" style={{ color: '#D99962' }}>
                          {player.place}-е место
                        </p>
                      )}
                    </div>
                  </div>

                  {unpaid.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {unpaid.map((tx) => (
                        <span
                          key={tx.id}
                          className="inline-flex items-center gap-1 rounded-lg pl-2 pr-1 py-1 text-[11px] font-700"
                          style={{
                            background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(239,68,68,0.35)',
                            color: '#f87171',
                          }}
                        >
                          {TRANSACTION_TYPE_LABEL[tx.type]}
                          <button
                            type="button"
                            onClick={() => removeTransaction(tx.id)}
                            className="w-5 h-5 rounded flex items-center justify-center"
                            aria-label={`Отменить ${TRANSACTION_TYPE_LABEL[tx.type]}`}
                          >
                            <X size={12} strokeWidth={2.6} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

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

                  {!eliminated && (
                    <button
                      type="button"
                      onClick={() => eliminatePlayer(player.id)}
                      className="w-full py-2.5 rounded-xl text-[12px] font-800 active:scale-[0.98] transition-transform"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#A39B98',
                      }}
                    >
                      Вылетел
                    </button>
                  )}

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
