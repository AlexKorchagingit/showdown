import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, MessageSquare, Minus, Plus, X } from 'lucide-react';
import { useTournaments } from '../../context/TournamentContext';
import { useFinance } from '../../context/FinanceContext';
import { TRANSACTION_TYPE_LABEL } from '../../types/finance';
import type { TransactionType } from '../../types/finance';
import { applyPlaceToParticipant, swapParticipantPlaces } from '../../data/prizeStructure';
import {
  canCloseTournament,
  nextEliminatedPlace,
  sortByPlace,
  sortFinancePlayers,
} from '../../lib/tournamentStatus';
import { PlayerNameLink } from '../../components/PlayerNameLink';
import type { TournamentDealer } from '../../types/tournament';

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

  const [query, setQuery] = useState('');
  const [dealerName, setDealerName] = useState('');
  const [dealerHours, setDealerHours] = useState('');

  const tournament = tournaments.find((t) => t.id === id);

  const filtered = useMemo(() => {
    if (!tournament) return [];
    const q = query.trim().toLowerCase();
    const list = q
      ? tournament.participants.filter((p) => p.nickname.toLowerCase().includes(q))
      : tournament.participants;
    return sortFinancePlayers(list, tournament.isClosed);
  }, [tournament, query]);

  if (!tournament) return <Navigate to="/admin/finance" replace />;

  const placedOrdered = sortByPlace(
    tournament.participants.filter((p) => typeof p.place === 'number'),
  );
  const canClose = canCloseTournament(tournament.participants);
  const nonPlayingDealers = tournament.dealers ?? [];

  const handleTicket = (userId: string, nickname: string) => {
    const reason = window.prompt(`Причина выдачи билета для ${nickname}?`, '');
    if (reason === null) return;
    addTicket(tournament.id, userId, reason.trim() || 'Билет');
  };

  const closeTournament = () => {
    if (tournament.isClosed || !canClose) return;
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

  const movePlace = (playerId: string, direction: -1 | 1) => {
    const idx = placedOrdered.findIndex((p) => p.id === playerId);
    const neighbor = placedOrdered[idx + direction];
    if (idx < 0 || !neighbor) return;
    updateTournament(tournament.id, {
      participants: swapParticipantPlaces(
        tournament.participants,
        playerId,
        neighbor.id,
        tournament.guarantee,
      ),
    });
  };

  const setPlayerComment = (playerId: string, nickname: string, current?: string) => {
    const next = window.prompt(`Комментарий к игроку ${nickname}`, current ?? '');
    if (next === null) return;
    updateTournament(tournament.id, {
      participants: tournament.participants.map((p) =>
        p.id === playerId ? { ...p, comment: next.trim() } : p,
      ),
    });
  };

  const addNonPlayingDealer = () => {
    const name = dealerName.trim();
    const hoursRaw = Number(dealerHours.replace(',', '.'));
    if (!name || !Number.isFinite(hoursRaw) || hoursRaw <= 0) return;
    const hours = Math.floor(hoursRaw);
    const minutes = Math.round((hoursRaw - hours) * 60);
    const row: TournamentDealer = { name, hours, minutes };
    updateTournament(tournament.id, {
      dealers: [...nonPlayingDealers, row],
    });
    setDealerName('');
    setDealerHours('');
  };

  const removeNonPlayingDealer = (index: number) => {
    updateTournament(tournament.id, {
      dealers: nonPlayingDealers.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <div className="flex-shrink-0 px-3 pt-2 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin/finance')}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(28,20,16,0.78)',
              border: '1px solid rgba(217,153,98,0.28)',
            }}
            aria-label="Назад"
          >
            <ArrowLeft size={20} strokeWidth={2.2} style={{ color: '#D99962' }} />
          </button>
          <h1 className="shrink-0 text-[12px] font-800 tracking-[0.14em] text-white uppercase">
            Касса турнира
          </h1>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск…"
            className="flex-1 min-w-0 h-10 rounded-xl px-3 text-[13px] text-white outline-none"
            style={{
              background: '#231A16',
              border: '1px solid rgba(217,153,98,0.35)',
            }}
          />
        </div>

        <p className="text-center text-[13px] font-600 uppercase tracking-wide" style={{ color: '#D99962' }}>
          {tournament.title}
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
            disabled={!canClose}
            onClick={closeTournament}
            className="w-full py-3.5 rounded-xl text-[14px] font-800 tracking-wide active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(to right, #7f1d1d, #ef4444)',
              color: '#fff',
              boxShadow: canClose ? '0 0 18px rgba(239,68,68,0.28)' : 'none',
            }}
          >
            ЗАКРЫТЬ ТУРНИР
          </button>
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
              const placedIdx = placedOrdered.findIndex((p) => p.id === player.id);
              const canMoveUp = eliminated && placedIdx > 0;
              const canMoveDown = eliminated && placedIdx >= 0 && placedIdx < placedOrdered.length - 1;

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
                        <PlayerNameLink
                          id={player.id}
                          nickname={player.nickname}
                          className="text-[14px] font-700 text-white truncate"
                        />
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
                      {player.comment?.trim() && (
                        <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: '#A39B98' }}>
                          {player.comment}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPlayerComment(player.id, player.nickname, player.comment)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: 'rgba(217,153,98,0.12)',
                        border: '1px solid rgba(217,153,98,0.35)',
                      }}
                      aria-label="Комментарий к игроку"
                    >
                      <MessageSquare size={16} style={{ color: '#D99962' }} />
                    </button>
                    {eliminated && (
                      <div className="flex flex-col shrink-0 -my-1">
                        <button
                          type="button"
                          disabled={!canMoveUp}
                          onClick={() => movePlace(player.id, -1)}
                          className="w-7 h-6 flex items-center justify-center disabled:opacity-25"
                          aria-label="Выше"
                        >
                          <ChevronUp size={16} style={{ color: '#D99962' }} />
                        </button>
                        <button
                          type="button"
                          disabled={!canMoveDown}
                          onClick={() => movePlace(player.id, 1)}
                          className="w-7 h-6 flex items-center justify-center disabled:opacity-25"
                          aria-label="Ниже"
                        >
                          <ChevronDown size={16} style={{ color: '#D99962' }} />
                        </button>
                      </div>
                    )}
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
                        <Plus size={14} style={{ color: '#D99962' }} />
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

        <div
          className="mt-6 rounded-2xl p-4 space-y-3"
          style={{ background: '#2A211D', border: '1px solid rgba(217,153,98,0.22)' }}
        >
          <h3 className="text-[12px] font-700 uppercase tracking-[0.16em]" style={{ color: '#F2D8A7' }}>
            Добавить неиграющего дилера
          </h3>

          {nonPlayingDealers.length > 0 && (
            <div className="space-y-2">
              {nonPlayingDealers.map((row, index) => (
                <div
                  key={`${row.name}-${index}`}
                  className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{ background: 'rgba(17,11,9,0.55)' }}
                >
                  <p className="flex-1 min-w-0 text-[13px] font-700 text-white truncate">{row.name}</p>
                  <p className="text-[12px] font-700 shrink-0" style={{ color: '#D99962' }}>
                    {row.hours} ч {row.minutes} мин
                  </p>
                  <button
                    type="button"
                    onClick={() => removeNonPlayingDealer(index)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    aria-label={`Удалить ${row.name}`}
                  >
                    <X size={14} style={{ color: '#A39B98' }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={dealerName}
              onChange={(e) => setDealerName(e.target.value)}
              placeholder="Имя"
              className="flex-1 min-w-0 h-11 rounded-xl px-3 text-[13px] text-white outline-none"
              style={{
                background: '#231A16',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            />
            <input
              value={dealerHours}
              onChange={(e) => setDealerHours(e.target.value)}
              placeholder="Часы"
              inputMode="decimal"
              className="w-20 h-11 rounded-xl px-3 text-[13px] text-white outline-none text-center"
              style={{
                background: '#231A16',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            />
            <button
              type="button"
              onClick={addNonPlayingDealer}
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(to right, #8C4C27, #D99962)',
                color: '#0A0908',
              }}
              aria-label="Добавить дилера"
            >
              <Plus size={18} strokeWidth={2.6} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
