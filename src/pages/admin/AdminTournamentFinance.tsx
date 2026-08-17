import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, ChevronUp, Crosshair, MessageSquare, Minus, Plus, UserPlus, X } from 'lucide-react';
import { useTournaments } from '../../context/TournamentContext';
import { useFinance } from '../../context/FinanceContext';
import { useAuditLog } from '../../context/AuditLogContext';
import { DEFAULT_ENTRY_FEE, TRANSACTION_TYPE_LABEL } from '../../types/finance';
import type { TransactionType } from '../../types/finance';
import {
  applyPlaceToParticipant,
  calculatePayouts,
  closeTournamentWithPayouts,
  parseKnockoutCount,
  swapParticipantPlaces,
} from '../../data/prizeStructure';
import {
  nextEliminatedPlace,
  sortByPlace,
  sortFinancePlayers,
} from '../../lib/tournamentStatus';
import { formatTxDateTime } from '../../lib/transactionDisplay';
import { PlayerNameLink } from '../../components/PlayerNameLink';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import type { TournamentDealer } from '../../types/tournament';
import { ALL_PARTICIPANTS } from '../../data/participants';
import { CURRENT_USER_RATING } from '../../types/player';
import { playerEmail, systemPlayerDirectory } from '../../lib/systemPlayers';
import { hasGlobalUnpaidDebt } from '../../lib/playerAnalytics';

const CHARGE_ACTIONS: { type: Exclude<TransactionType, 'ticket'>; label: string }[] = [
  { type: 'buy-in', label: 'Вход' },
  { type: 'rebuy', label: 'Ребай' },
  { type: 'addon', label: 'Аддон' },
];

function resolveSeasonRating(nickname: string): number {
  const fromPool = ALL_PARTICIPANTS.find((p) => p.nickname === nickname);
  if (fromPool) return fromPool.rating;
  if (nickname === CURRENT_USER_RATING.nickname) return CURRENT_USER_RATING.points;
  return 0;
}

function formatHourDelta(delta: number): string {
  const abs = Math.abs(delta);
  const amount = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace('.', ',');
  return `${delta > 0 ? '+' : '−'}${amount}ч`;
}

function FadingHoursDelta({ flash }: { flash?: { delta: number; token: number } }) {
  if (!flash) return null;
  return (
    <motion.span
      key={flash.token}
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 0, y: -8 }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
      className={`text-[11px] font-800 ${flash.delta > 0 ? 'text-green-400' : 'text-red-500'}`}
    >
      {formatHourDelta(flash.delta)}
    </motion.span>
  );
}

export function AdminTournamentFinance() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tournaments, updateTournament } = useTournaments();
  const { logAction } = useAuditLog();
  const {
    transactions,
    addCharge,
    addTicket,
    getDealerHours,
    getDealerLoggedAt,
    adjustDealerHours,
    unpaidForPlayer,
    unpaidTotalForPlayer,
    markPlayerPaid,
    removeTransaction,
  } = useFinance();

  const [query, setQuery] = useState('');
  const [dealerName, setDealerName] = useState('');
  const [dealerHours, setDealerHours] = useState('');
  const [hourFlash, setHourFlash] = useState<Record<string, { delta: number; token: number }>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [tournamentComment, setTournamentComment] = useState('');
  const commentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tournament = tournaments.find((t) => t.id === id);

  const filtered = useMemo(() => {
    if (!tournament) return [];
    const q = query.trim().toLowerCase();
    const list = q
      ? tournament.participants.filter((p) => p.nickname.toLowerCase().includes(q))
      : tournament.participants;
    return sortFinancePlayers(list, tournament.isClosed);
  }, [tournament, query]);

  useEffect(() => {
    setTournamentComment(tournament?.adminSecretComment ?? '');
  }, [tournament?.id, tournament?.adminSecretComment]);

  useEffect(
    () => () => {
      if (commentTimer.current) clearTimeout(commentTimer.current);
    },
    [],
  );

  if (!tournament) return <Navigate to="/admin/finance" replace />;

  const placedOrdered = sortByPlace(
    tournament.participants.filter((p) => typeof p.place === 'number'),
  );
  const remainingInPlay = tournament.participants.filter((p) => typeof p.place !== 'number').length;
  const closeBlocked = remainingInPlay > 1;
  const nonPlayingDealers = tournament.dealers ?? [];
  const takenIds = new Set(tournament.participants.map((p) => p.id));
  const takenNicks = new Set(tournament.participants.map((p) => p.nickname.toLowerCase()));
  const availablePlayers = systemPlayerDirectory().filter(
    (user) => !takenIds.has(user.id) && !takenNicks.has(user.nickname.toLowerCase()),
  );

  const flashHours = (key: string, delta: number) => {
    setHourFlash((prev) => ({ ...prev, [key]: { delta, token: Date.now() } }));
  };

  const persistComment = (value: string) => {
    updateTournament(tournament.id, { adminSecretComment: value });
  };

  const handleCommentChange = (value: string) => {
    setTournamentComment(value);
    if (commentTimer.current) clearTimeout(commentTimer.current);
    commentTimer.current = setTimeout(() => persistComment(value), 400);
  };

  const handleCommentBlur = () => {
    if (commentTimer.current) {
      clearTimeout(commentTimer.current);
      commentTimer.current = null;
    }
    persistComment(tournamentComment);
  };

  const handleTicket = (userId: string, nickname: string) => {
    const reason = window.prompt(`Причина выдачи билета для ${nickname}?`, '');
    if (reason === null) return;
    addTicket(tournament.id, userId, reason.trim() || 'Билет');
    logAction({
      actionType: 'Выдал билет',
      targetUserId: userId,
      targetUserEmail: playerEmail(userId, nickname),
      targetUserName: nickname,
      targetTournamentId: tournament.id,
      targetTournamentName: tournament.title,
      details: `Причина: ${reason.trim() || 'Билет'}`,
    });
  };

  const handleCharge = (
    userId: string,
    nickname: string,
    type: Exclude<TransactionType, 'ticket'>,
  ) => {
    addCharge(tournament.id, userId, type);
    logAction({
      actionType: 'Создал транзакцию',
      targetUserId: userId,
      targetUserEmail: playerEmail(userId, nickname),
      targetUserName: nickname,
      targetTournamentId: tournament.id,
      targetTournamentName: tournament.title,
      details: `${TRANSACTION_TYPE_LABEL[type]}. Сумма: ${DEFAULT_ENTRY_FEE.toLocaleString('ru-RU')} руб`,
    });
  };

  const handlePayDebt = (userId: string, nickname: string, amount: number) => {
    markPlayerPaid(tournament.id, userId);
    logAction({
      actionType: 'Погасил долг',
      targetUserId: userId,
      targetUserEmail: playerEmail(userId, nickname),
      targetUserName: nickname,
      targetTournamentId: tournament.id,
      targetTournamentName: tournament.title,
      details: `Сумма: ${amount.toLocaleString('ru-RU')} руб`,
    });
  };

  const closeTournament = () => {
    if (tournament.isClosed) return;
    if (closeBlocked) {
      window.alert('Не все участники вылетели!');
      return;
    }
    const payouts = calculatePayouts(tournament.participants.length, tournament.guarantee);
    const preview =
      payouts.length === 0
        ? 'Призовых мест нет.'
        : `В призах: ${payouts.length} чел. (30%)\n${payouts
            .map((row) => `${row.place}-е место — ${row.points.toLocaleString('ru-RU')} очков`)
            .join('\n')}`;
    const bountyNote = tournament.isBounty
      ? '\n\nНокаут-турнир: к очкам за место добавится 200 за каждый нокаут.'
      : '';
    if (
      !window.confirm(
        `Закрыть турнир? Он станет прошедшим, запись будет недоступна.\n\n${preview}${bountyNote}\n\nЭти очки будут начислены по занятым местам.`,
      )
    ) {
      return;
    }

    let closingParticipants = tournament.participants;
    if (tournament.isBounty) {
      const leftover = closingParticipants.filter((p) => typeof p.place !== 'number');
      if (leftover.length === 1) {
        const raw = window.prompt(
          'Сколько нокаутов сделал игрок?',
          String(leftover[0].knockouts ?? 0),
        );
        if (raw === null) return;
        const knockouts = parseKnockoutCount(raw);
        closingParticipants = closingParticipants.map((p) =>
          p.id === leftover[0].id ? { ...p, knockouts } : p,
        );
      }
    }

    updateTournament(tournament.id, {
      isClosed: true,
      resultsEntered: true,
      participants: closeTournamentWithPayouts(
        closingParticipants,
        tournament.guarantee,
        tournament.isBounty === true,
      ),
    });
    logAction({
      actionType: 'Закрыл турнир',
      targetTournamentId: tournament.id,
      targetTournamentName: tournament.title,
      details: `Внесены результаты. Игроков: ${closingParticipants.length}`,
    });
  };

  const eliminatePlayer = (playerId: string) => {
    const place = nextEliminatedPlace(tournament.participants);
    if (place == null) return;
    const player = tournament.participants.find((p) => p.id === playerId);
    if (!player) return;

    let knockouts = player.knockouts;
    if (tournament.isBounty) {
      const raw = window.prompt('Сколько нокаутов сделал игрок?', String(knockouts ?? 0));
      if (raw === null) return;
      knockouts = parseKnockoutCount(raw);
    }

    const totalPlayers = tournament.participants.length;
    const syncRating = tournament.resultsEntered === true;
    const oldRating = player.rating;
    updateTournament(tournament.id, {
      participants: tournament.participants.map((p) => {
        if (p.id !== playerId) return p;
        const next = syncRating
          ? applyPlaceToParticipant(p, place, tournament.guarantee, totalPlayers)
          : { ...p, place };
        return tournament.isBounty ? { ...next, knockouts } : next;
      }),
    });
    const newRating = syncRating
      ? applyPlaceToParticipant(player, place, tournament.guarantee, totalPlayers).rating
      : player.rating;
    const ratingNote =
      syncRating && newRating !== oldRating
        ? ` Рейтинг изменен с ${oldRating.toLocaleString('ru-RU')} на ${newRating.toLocaleString('ru-RU')}.`
        : '';
    logAction({
      actionType: 'Добавил результат',
      targetUserId: player.id,
      targetUserEmail: playerEmail(player.id, player.nickname),
      targetUserName: player.nickname,
      targetTournamentId: tournament.id,
      targetTournamentName: tournament.title,
      details: `${place} место.${ratingNote}`,
    });
  };

  const addPlayerToTournament = (id: string, nickname: string) => {
    if (tournament.participants.some((p) => p.id === id || p.nickname === nickname)) return;
    if (tournament.participants.length >= tournament.totalSeats) return;
    updateTournament(tournament.id, {
      participants: [
        ...tournament.participants,
        { id, nickname, rating: resolveSeasonRating(nickname) },
      ],
    });
    logAction({
      actionType: 'Добавил игрока',
      targetUserId: id,
      targetUserEmail: playerEmail(id, nickname),
      targetUserName: nickname,
      targetTournamentId: tournament.id,
      targetTournamentName: tournament.title,
    });
    setAddOpen(false);
  };

  const removePlayerFromTournament = (playerId: string) => {
    if (!window.confirm('Точно удалить игрока из турнира?')) return;
    const player = tournament.participants.find((p) => p.id === playerId);
    updateTournament(tournament.id, {
      participants: tournament.participants.filter((p) => p.id !== playerId),
    });
    logAction({
      actionType: 'Удалил игрока',
      targetUserId: player?.id,
      targetUserEmail: player ? playerEmail(player.id, player.nickname) : undefined,
      targetUserName: player?.nickname,
      targetTournamentId: tournament.id,
      targetTournamentName: tournament.title,
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
        tournament.resultsEntered === true,
      ),
    });
    const from = placedOrdered[idx].place;
    const to = neighbor.place;
    if (typeof from === 'number' && typeof to === 'number') {
      logAction({
        actionType: 'Изменил место',
        targetUserId: playerId,
        targetUserEmail: playerEmail(placedOrdered[idx].id, placedOrdered[idx].nickname),
        targetUserName: placedOrdered[idx].nickname,
        targetTournamentId: tournament.id,
        targetTournamentName: tournament.title,
        details: `Было ${from} место → стало ${to} место`,
      });
    }
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

  const setDealerComment = (index: number, name: string, current?: string) => {
    const next = window.prompt(`Комментарий к дилеру ${name}`, current ?? '');
    if (next === null) return;
    updateTournament(tournament.id, {
      dealers: nonPlayingDealers.map((row, i) =>
        i === index ? { ...row, comment: next.trim() } : row,
      ),
    });
  };

  const adjustNonPlayingDealerHours = (index: number, deltaHours: number) => {
    const row = nonPlayingDealers[index];
    if (!row) return;
    const total = Math.max(0, row.hours * 60 + row.minutes + deltaHours * 60);
    const hours = Math.floor(total / 60);
    const minutes = Math.round(total % 60);
    updateTournament(tournament.id, {
      dealers: nonPlayingDealers.map((item, i) =>
        i === index
          ? { ...item, hours, minutes, loggedAt: new Date().toISOString() }
          : item,
      ),
    });
    flashHours(`np-${index}`, deltaHours);
  };

  const addNonPlayingDealer = () => {
    const name = dealerName.trim();
    const hoursRaw = Number(dealerHours.replace(',', '.'));
    if (!name || !Number.isFinite(hoursRaw) || hoursRaw <= 0) return;
    const hours = Math.floor(hoursRaw);
    const minutes = Math.round((hoursRaw - hours) * 60);
    const row: TournamentDealer = { name, hours, minutes, loggedAt: new Date().toISOString() };
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

        {!tournament.isClosed && (
          <div>
            <button
              type="button"
              onClick={() => setAddOpen((open) => !open)}
              className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-[13px] font-800 active:scale-[0.98] transition-transform"
              style={{
                background: 'rgba(217,153,98,0.12)',
                border: '1px solid rgba(217,153,98,0.4)',
                color: '#F2D8A7',
              }}
            >
              <UserPlus size={16} strokeWidth={2.3} />
              + Добавить игрока
            </button>
            <AnimatePresence initial={false}>
              {addOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div
                    className="mt-2 max-h-52 scrollable space-y-1.5 rounded-xl p-2"
                    style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    {availablePlayers.length === 0 ? (
                      <p className="text-center text-[12px] py-3" style={{ color: '#6B6360' }}>
                        Все пользователи уже в турнире
                      </p>
                    ) : (
                      availablePlayers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => addPlayerToTournament(user.id, user.nickname)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg active:scale-[0.98]"
                          style={{ background: '#231A16' }}
                        >
                          <span className="min-w-0 text-left">
                            <span className="block text-[13px] font-700 text-white truncate">
                              {user.nickname}
                            </span>
                            {user.email ? (
                              <span className="block text-[10px] text-[#8c8c88] truncate">
                                {user.email}
                              </span>
                            ) : null}
                          </span>
                          <Plus size={15} strokeWidth={2.4} style={{ color: '#D99962' }} />
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

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
            aria-disabled={closeBlocked}
            onClick={closeTournament}
            className={`w-full py-3.5 rounded-xl text-[14px] font-800 tracking-wide transition-transform ${
              closeBlocked ? 'opacity-40 cursor-not-allowed' : 'active:scale-[0.98]'
            }`}
            style={{
              background: 'linear-gradient(to right, #7f1d1d, #ef4444)',
              color: '#fff',
              boxShadow: closeBlocked ? 'none' : '0 0 18px rgba(239,68,68,0.28)',
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
              const tickets = transactions.filter(
                (tx) =>
                  tx.tournamentId === tournament.id &&
                  tx.userId === player.id &&
                  tx.type === 'ticket',
              );
              const hours = getDealerHours(tournament.id, player.id);
              const dealerLoggedAt = getDealerLoggedAt(tournament.id, player.id);
              const hasLocalDebt = unpaid.length > 0;
              const hasDebt = hasGlobalUnpaidDebt(transactions, player.id);
              const canRemove = !tournament.isClosed;
              const eliminated = typeof player.place === 'number';
              const placedIdx = placedOrdered.findIndex((p) => p.id === player.id);
              const canMoveUp = eliminated && placedIdx > 0;
              const canMoveDown = eliminated && placedIdx >= 0 && placedIdx < placedOrdered.length - 1;
              const email = playerEmail(player.id, player.nickname);

              return (
                <div
                  key={player.id}
                  className="rounded-2xl p-4 space-y-3"
                  style={{
                    background: '#2A211D',
                    border: hasLocalDebt
                      ? '1px solid rgba(239,68,68,0.45)'
                      : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className={`space-y-3 ${eliminated ? 'opacity-50 grayscale' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar playerId={player.id} nickname={player.nickname} size="sm" />
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
                      {email ? (
                        <p className="text-[10px] text-[#8c8c88] truncate">{email}</p>
                      ) : null}
                      {eliminated && (
                        <p className="text-[12px] font-800 mt-0.5" style={{ color: '#D99962' }}>
                          {player.place}-е место
                        </p>
                      )}
                      {tournament.isBounty && (
                        <p
                          className="flex items-center gap-1 text-[11px] font-700 mt-0.5"
                          style={{ color: '#F2D8A7' }}
                        >
                          <Crosshair size={12} strokeWidth={2.4} />
                          x {player.knockouts ?? 0}
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
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => removePlayerFromTournament(player.id)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: 'rgba(239,68,68,0.12)',
                          border: '1px solid rgba(239,68,68,0.35)',
                        }}
                        aria-label="Удалить из турнира"
                      >
                        <X size={16} strokeWidth={2.4} style={{ color: '#f87171' }} />
                      </button>
                    )}
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

                  {(unpaid.length > 0 || tickets.length > 0) && (
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
                      {tickets.map((tx) => (
                        <span
                          key={tx.id}
                          className="inline-flex items-center gap-1 rounded-lg pl-2 pr-1 py-1 text-[11px] font-700"
                          style={{
                            background: 'rgba(34,197,94,0.12)',
                            border: '1px solid rgba(34,197,94,0.35)',
                            color: '#86efac',
                          }}
                          title={tx.comment || 'Билет'}
                        >
                          Билет
                          <button
                            type="button"
                            onClick={() => removeTransaction(tx.id)}
                            className="w-5 h-5 rounded flex items-center justify-center"
                            aria-label="Аннулировать билет"
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
                        onClick={() => handleCharge(player.id, player.nickname, type)}
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
                      <span className="relative w-0 h-0 overflow-visible">
                        <span className="absolute right-1 bottom-3 whitespace-nowrap">
                          <FadingHoursDelta flash={hourFlash[player.id]} />
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          adjustDealerHours(tournament.id, player.id, -0.5);
                          flashHours(player.id, -0.5);
                        }}
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
                        onClick={() => {
                          adjustDealerHours(tournament.id, player.id, 0.5);
                          flashHours(player.id, 0.5);
                        }}
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
                  {dealerLoggedAt ? (
                    <p className="text-[10px] font-600 -mt-2 text-right" style={{ color: '#8c8c88' }}>
                      {formatTxDateTime(dealerLoggedAt)}
                    </p>
                  ) : null}
                  </div>

                  {hasLocalDebt && unpaidTotal > 0 && (
                    <button
                      type="button"
                      onClick={() => handlePayDebt(player.id, player.nickname, unpaidTotal)}
                      className="w-full py-3 rounded-xl text-[13px] bg-red-900/80 border border-red-500/50 text-white font-bold active:scale-[0.98] transition-transform"
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
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-700 text-white truncate">{row.name}</p>
                    {row.loggedAt ? (
                      <p className="text-[10px] font-600 mt-0.5" style={{ color: '#8c8c88' }}>
                        {formatTxDateTime(row.loggedAt)}
                      </p>
                    ) : null}
                    {row.comment?.trim() ? (
                      <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: '#A39B98' }}>
                        {row.comment}
                      </p>
                    ) : null}
                  </div>
                  <FadingHoursDelta flash={hourFlash[`np-${index}`]} />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => adjustNonPlayingDealerHours(index, -0.5)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      aria-label="Минус полчаса"
                    >
                      <Minus size={13} style={{ color: '#A39B98' }} />
                    </button>
                    <p className="text-[12px] font-700 w-[4.5rem] text-center" style={{ color: '#D99962' }}>
                      {row.hours} ч {row.minutes} мин
                    </p>
                    <button
                      type="button"
                      onClick={() => adjustNonPlayingDealerHours(index, 0.5)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      aria-label="Плюс полчаса"
                    >
                      <Plus size={13} style={{ color: '#D99962' }} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDealerComment(index, row.name, row.comment)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: 'rgba(217,153,98,0.12)',
                      border: '1px solid rgba(217,153,98,0.35)',
                    }}
                    aria-label={`Комментарий к ${row.name}`}
                  >
                    <MessageSquare size={13} style={{ color: '#D99962' }} />
                  </button>
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

        <div
          className="mt-6 rounded-2xl p-4 space-y-3"
          style={{ background: '#2A211D', border: '1px solid rgba(217,153,98,0.22)' }}
        >
          <h3 className="text-[12px] font-700 uppercase tracking-[0.16em]" style={{ color: '#F2D8A7' }}>
            Комментарии по турниру
          </h3>
          <textarea
            value={tournamentComment}
            onChange={(e) => handleCommentChange(e.target.value)}
            onBlur={handleCommentBlur}
            placeholder="Заметки для служебной информации…"
            rows={4}
            className="w-full rounded-xl px-3 py-2.5 text-[13px] text-white outline-none resize-none"
            style={{
              background: '#231A16',
              border: '1px solid rgba(217,153,98,0.28)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
