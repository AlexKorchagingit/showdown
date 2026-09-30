import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Check, Clock, Eye, EyeOff, ImagePlus, Link2, Star, Timer, Trash2, UserPlus, Users, Wallet, X,
} from 'lucide-react';
import { DEFAULT_TOTAL_SEATS, type Participant, type Tournament } from '../../types/tournament';
import { useTournaments } from '../../context/TournamentContext';
import { useFinance } from '../../context/FinanceContext';
import { useUser } from '../../context/UserContext';
import { ScreenLoading } from '../../components/ScreenLoading';
import { FetchErrorCard } from '../../components/FetchErrorCard';
import { isFinished as hasFinished, sortByRating } from '../../lib/tournamentStatus';
import { EditableText } from '../../components/admin/EditableText';
import { FeatureListEditor } from '../../components/admin/FeatureListEditor';
import { BountyCheckbox } from '../../components/admin/BountyCheckbox';
import { BlindStructurePicker } from '../../components/admin/BlindStructurePicker';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { TOURNAMENT_ART_FADE } from '../../lib/tournamentArt';
import { TournamentArtImage } from '../../components/TournamentArtImage';
import { fileToTournamentImageUrl } from '../../lib/tournamentPhoto';
import { useBindPokerTimer } from '../../hooks/useBindPokerTimer';
import { seasonPointsByUserId, withClubSeasonRating, clubUserIdSet, countOccupiedLobbySeats } from '../../lib/clubRating';
import { CopyTournamentModal } from '../../components/admin/CopyTournamentModal';
import { DeleteTournamentModal } from '../../components/admin/DeleteTournamentModal';
import {
  AddTournamentPlayerButton,
  TournamentPlayerPicker,
} from '../../components/admin/TournamentPlayerPicker';
import {
  GUEST_NICKNAME_MAX,
  guestParticipantId,
  guestSeatKey,
  isUnboundGuestSeat,
  ledgerChargeId,
  normalizeGuestNickname,
} from '../../lib/guestPlayer';
import { sanitizeParticipantUserId, type MappedUser } from '../../lib/supabaseMap';
import { isArrivedPlayer } from '../../lib/tournamentArrival';
import { lobbyArrivedHitStyle, lobbyArrivedRowStyle, TMA_FILL } from '../../lib/tmaFill';
import { FlatHit } from '../../components/FlatHit';
import { alignBustOutPlaces } from '../../lib/bustOutPlaces';
import {
  assignRandomTeamPairs,
  findTeamPartner,
  hasAnyTeamPair,
  isTeamBattleEvent,
  rebindTeamPartnerIdentity,
  removeSeatKeepingTeams,
  setTeamPartner,
} from '../../lib/teamBattle';

const CARD_STYLE = {
  background: '#2A211D',
  border: '1px solid rgba(255,255,255,0.06)',
} as const;

const SECTION_TITLE = 'text-[12px] font-700 uppercase tracking-[0.2em]';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ── Hero with editable title, date, time and photo ─────────────────────── */
function EditableHero({
  tournament,
  photoOverride,
  photoBusy,
  onPatch,
  onPickPhoto,
}: {
  tournament: Tournament;
  photoOverride: string | null;
  photoBusy: boolean;
  onPatch: (patch: Partial<Tournament>) => void;
  onPickPhoto: () => void;
}) {
  const heroImage = photoOverride ?? tournament.imageUrl;

  return (
    <div
      className="relative overflow-hidden rounded-2xl mx-4 mt-2"
      style={{ minHeight: 180, background: '#1d0b07' }}
    >
      <div className="absolute inset-0 z-0 overflow-hidden bg-transparent border-0 shadow-none ring-0 outline-none">
        <TournamentArtImage
          src={heroImage}
          tournamentId={tournament.id}
          custom={photoOverride !== null ? true : undefined}
        />
        <div
          className="absolute inset-0 pointer-events-none border-0 shadow-none ring-0"
          style={TOURNAMENT_ART_FADE}
        />
      </div>

      {/* Photo edit button */}
      <button
        type="button"
        onClick={onPickPhoto}
        disabled={photoBusy}
        aria-label="Изменить фото"
        className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60"
        style={{
          background: 'rgba(28,20,16,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(217,153,98,0.4)',
        }}
      >
        <ImagePlus size={18} strokeWidth={2.2} style={{ color: '#D99962' }} />
      </button>

      <div className="relative z-20 px-6 pt-16 pb-5" style={{ width: '82%' }}>
        <p className={`${SECTION_TITLE} mb-2`} style={{ color: '#D99962' }}>
          Лобби турнира
        </p>

        <EditableText
          value={tournament.title}
          onSave={(v) => onPatch({ title: v.toUpperCase() })}
          maxLength={40}
          placeholder="Название турнира"
          className="mb-2"
          pencilSize={16}
          renderValue={(v) => (
            <h1
              className="text-2xl font-black text-white uppercase leading-tight"
              style={{ letterSpacing: '0.04em' }}
            >
              {v || 'Без названия'}
            </h1>
          )}
        />

        <div className="space-y-1.5">
          <EditableText
            value={tournament.startDate}
            onSave={(v) => onPatch({ startDate: v })}
            type="date"
            renderValue={(v) => (
              <span
                className="flex items-center gap-2 text-[12px]"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                <Calendar size={12} style={{ color: '#c8a38e' }} />
                <span className="capitalize">{formatDate(v)}</span>
              </span>
            )}
          />

          <EditableText
            value={tournament.startTime}
            onSave={(v) => onPatch({ startTime: v })}
            type="time"
            renderValue={(v) => (
              <span
                className="flex items-center gap-2 text-[12px]"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                <Clock size={12} style={{ color: '#c8a38e' }} />
                {v}
              </span>
            )}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Participants editor ───────────────────────────────────────────────── */
function ParticipantsEditor({
  participants,
  totalSeats,
  clubUsers,
  tournamentId,
  teamBattle,
  pairingEnabled,
  pairingPlayerId,
  addOpen,
  linkingNickname,
  pickerUsers,
  onToggleAdd,
  onPickUser,
  onAddGuestNick,
  onToggleArrived,
  onBindGuest,
  onRemove,
  onDistributeTeams,
  onStartPairing,
  onPickPartner,
  onClearPartner,
}: {
  participants: Participant[];
  totalSeats: number;
  clubUsers: MappedUser[];
  tournamentId: string;
  teamBattle: boolean;
  pairingEnabled: boolean;
  pairingPlayerId: string | null;
  addOpen: boolean;
  linkingNickname?: string;
  pickerUsers: MappedUser[];
  onToggleAdd: () => void;
  onPickUser: (user: MappedUser) => void;
  onAddGuestNick: (nickname: string) => void;
  onToggleArrived: (id: string) => void;
  onBindGuest: (id: string) => void;
  onRemove: (id: string) => void;
  onDistributeTeams: () => void;
  onStartPairing: (id: string) => void;
  onPickPartner: (playerId: string, partnerId: string) => void;
  onClearPartner: (playerId: string) => void;
}) {
  const { tournaments } = useTournaments();
  const seasonById = seasonPointsByUserId(clubUsers, tournaments);
  const ranked = sortByRating(participants.map((p) => withClubSeasonRating(p, seasonById)));
  const emailById = new Map(clubUsers.map((user) => [user.id, user.email]));
  const pairingPlayer = pairingPlayerId
    ? participants.find((player) => player.id === pairingPlayerId)
    : undefined;
  const partnerChoices = pairingPlayer
    ? participants.filter((player) => player.id !== pairingPlayer.id && isArrivedPlayer(player))
    : [];

  return (
    <div className="rounded-2xl overflow-hidden" style={CARD_STYLE}>
      <div className="px-5 pt-4 pb-3 space-y-3">
        <AddTournamentPlayerButton
          label={linkingNickname ? `Привязать «${linkingNickname}»` : '+ Добавить игрока'}
          onClick={onToggleAdd}
        />
        <TournamentPlayerPicker
          open={addOpen}
          users={pickerUsers}
          linkingNickname={linkingNickname}
          onPickUser={onPickUser}
          onAddGuestNick={linkingNickname ? undefined : onAddGuestNick}
        />
        {teamBattle && pairingEnabled ? (
          <button
            type="button"
            onClick={onDistributeTeams}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-700 active:scale-[0.98] transition-transform"
            style={{
              background: 'rgba(217,153,98,0.12)',
              border: '1px solid rgba(217,153,98,0.4)',
              color: '#F2D8A7',
            }}
          >
            <Users size={16} strokeWidth={2.4} />
            Распределить команды
          </button>
        ) : null}
      </div>

      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <h3 className={SECTION_TITLE} style={{ color: '#F2D8A7' }}>
          Участники ({participants.length}/{totalSeats})
        </h3>
        <span className="text-[12px] font-600" style={{ color: '#D99962' }}>
          Рейтинг сезона
        </span>
      </div>

      {ranked.length === 0 ? (
        <p className="px-5 py-4 text-[13px] font-500" style={{ color: '#6B6360' }}>
          Участники не добавлены
        </p>
      ) : (
        <div>
          {ranked.map((p, idx) => {
            const isFinalTable = idx < 9;
            const arrived = isArrivedPlayer(p);
            const unboundGuest = isUnboundGuestSeat(p);
            const uid = sanitizeParticipantUserId(p.userId ?? p.id);
            const email = unboundGuest ? '' : ((uid && emailById.get(uid)) || '').trim();
            const partner = teamBattle ? findTeamPartner(participants, p, tournamentId) : undefined;
            const pairingThis = pairingPlayerId === p.id;

            return (
              <div key={p.id}>
              <div
                className="tma-opaque flex items-center gap-3 px-5 py-3 overflow-hidden"
                style={lobbyArrivedRowStyle({ idx, arrived, pairingThis })}
              >
                <FlatHit
                  onClick={() => onToggleArrived(p.id)}
                  aria-pressed={arrived}
                  aria-label={arrived ? `Снять отметку: ${p.nickname} пришёл` : `Отметить: ${p.nickname} пришёл`}
                  className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 active:scale-95"
                  style={lobbyArrivedHitStyle(arrived)}
                >
                  <Check
                    size={16}
                    strokeWidth={2.8}
                    style={{ color: arrived ? TMA_FILL.arrivedBar : TMA_FILL.checkIdle }}
                  />
                </FlatHit>

                <span
                  className="text-[11px] font-700 w-5 text-right shrink-0"
                  style={{ color: isFinalTable ? '#D99962' : '#ffffff' }}
                >
                  {idx + 1}
                </span>

                <PlayerAvatar playerId={p.id} nickname={p.nickname} size="sm" />

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-600 truncate text-white">{p.nickname}</p>
                  {email ? (
                    <p className="text-[11px] text-white/80 truncate">{email}</p>
                  ) : unboundGuest ? (
                    <p className="text-[11px] truncate" style={{ color: '#D99962' }}>
                      Ник без аккаунта · не в рейтинге
                    </p>
                  ) : null}
                  {partner ? (
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: '#D99962' }}>
                      {partner.nickname}
                    </p>
                  ) : null}
                </div>

                <span
                  className="text-[12px] font-700 block text-right min-w-[52px] shrink-0"
                  style={{ color: isFinalTable ? '#D99962' : '#ffffff' }}
                >
                  {p.rating.toLocaleString('ru-RU')}
                </span>

                {teamBattle && pairingEnabled ? (
                  <button
                    type="button"
                    onClick={() => onStartPairing(p.id)}
                    disabled={!arrived}
                    aria-label={`Выбрать пару для ${p.nickname}`}
                    title={arrived ? 'Выбрать или сменить сокомандника' : 'Сначала отметьте, что игрок пришёл'}
                    className="shrink-0 h-7 px-2 rounded-lg flex items-center justify-center gap-1 active:scale-95 disabled:opacity-40"
                    style={{
                      background: pairingThis ? 'rgba(217,153,98,0.28)' : 'rgba(217,153,98,0.12)',
                      border: '1px solid rgba(217,153,98,0.35)',
                    }}
                  >
                    <UserPlus size={13} strokeWidth={2.4} style={{ color: '#D99962' }} />
                    <span className="text-[10px] font-800 uppercase tracking-[0.06em]" style={{ color: '#D99962' }}>
                      Пара
                    </span>
                  </button>
                ) : null}

                {unboundGuest ? (
                  <button
                    type="button"
                    onClick={() => onBindGuest(p.id)}
                    aria-label={`Привязать ${p.nickname} к пользователю`}
                    className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center active:scale-95"
                    style={{
                      background: 'rgba(217,153,98,0.12)',
                      border: '1px solid rgba(217,153,98,0.35)',
                    }}
                  >
                    <Link2 size={13} strokeWidth={2.4} style={{ color: '#D99962' }} />
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  aria-label={`Удалить ${p.nickname}`}
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center active:scale-95 transition-transform"
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.35)',
                  }}
                >
                  <X size={13} strokeWidth={2.6} style={{ color: '#f87171' }} />
                </button>
              </div>
              {pairingThis && pairingPlayer ? (
                <div
                  className="mx-5 mb-3 rounded-xl p-3 space-y-2"
                  style={{ background: '#231A16', border: '1px solid rgba(217,153,98,0.35)' }}
                >
                  <p className="text-[11px] font-600" style={{ color: '#A39B98' }}>
                    Пара для «{pairingPlayer.nickname}»
                  </p>
                  {pairingPlayer.teamPartnerId ? (
                    <button
                      type="button"
                      onClick={() => onClearPartner(pairingPlayer.id)}
                      className="w-full text-left px-3 py-2 rounded-lg text-[13px] font-600"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}
                    >
                      Без пары
                    </button>
                  ) : null}
                  {partnerChoices.length === 0 ? (
                    <p className="text-[12px] px-1" style={{ color: '#6B6360' }}>
                      Нет других игроков из кассы
                    </p>
                  ) : (
                    partnerChoices.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => onPickPartner(pairingPlayer.id, candidate.id)}
                        className="w-full text-left px-3 py-2 rounded-lg text-[13px] font-600 text-white"
                        style={{
                          background:
                            pairingPlayer.teamPartnerId === candidate.id
                              ? 'rgba(217,153,98,0.22)'
                              : 'rgba(255,255,255,0.04)',
                        }}
                      >
                        {candidate.nickname}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Editor body ────────────────────────────────────────────────────────── */
function Editor({ tournament }: { tournament: Tournament }) {
  const navigate = useNavigate();
  const { tournaments, updateTournament, duplicateTournament, deleteTournament } = useTournaments();
  const { clubUsers } = useUser();
  const { transactions, addCharge, voidTransaction, refreshFinance } = useFinance();
  const { openTimerForTournament } = useBindPokerTimer();
  const entryGuard = useRef(new Set<string>());

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [pairingPlayerId, setPairingPlayerId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFinished = hasFinished(tournament);
  const teamBattle = isTeamBattleEvent(tournament);
  const occupiedSeats = tournament.participants.length;
  const copyPlayerCount = countOccupiedLobbySeats(
    tournament.participants,
    clubUserIdSet(clubUsers),
  );
  const takenIds = new Set(tournament.participants.map((p) => p.id));
  const takenNicks = new Set(tournament.participants.map((p) => p.nickname.toLowerCase()));
  const seatedUserIds = new Set(
    tournament.participants.flatMap((p) => {
      const uid = sanitizeParticipantUserId(p.userId ?? p.id);
      return uid ? [uid] : [];
    }),
  );
  const availablePlayers = clubUsers.filter(
    (user) => !takenIds.has(user.id) && !seatedUserIds.has(user.id) && !takenNicks.has(user.nickname.toLowerCase()),
  );
  const bindCandidates = clubUsers.filter(
    (user) => !takenIds.has(user.id) && !seatedUserIds.has(user.id),
  );
  const linkingPlayer = linkingId
    ? tournament.participants.find((p) => p.id === linkingId)
    : undefined;
  const pickerUsers = linkingId ? bindCandidates : availablePlayers;

  // Revoke the temporary object URL when it is replaced or the editor unmounts
  useEffect(() => {
    if (!photoPreview?.startsWith('blob:')) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const patch = (p: Partial<Tournament>) => updateTournament(tournament.id, p);

  const ensureArrivalEntry = (userId: string | null | undefined) => {
    const uid = ledgerChargeId(userId ?? '');
    if (!uid) return;
    const key = `${tournament.id}:${uid}`;
    if (entryGuard.current.has(key)) return;
    const hasEntry = transactions.some(
      (tx) =>
        tx.tournamentId === tournament.id &&
        tx.userId === uid &&
        !tx.voidedAt &&
        (tx.type === 'buy-in' || tx.type === 'ticket'),
    );
    if (hasEntry) return;
    entryGuard.current.add(key);
    addCharge(tournament.id, uid, 'buy-in');
    window.setTimeout(() => entryGuard.current.delete(key), 5000);
  };

  const dropLoneArrivalEntry = (userId: string | null | undefined) => {
    const uid = ledgerChargeId(userId ?? '');
    if (!uid) return;
    const rows = transactions.filter(
      (tx) => tx.tournamentId === tournament.id && tx.userId === uid && !tx.voidedAt,
    );
    const unpaidEntries = rows.filter((tx) => tx.type === 'buy-in' && tx.status === 'unpaid');
    const kept = rows.some((tx) => tx.type !== 'buy-in' || tx.status !== 'unpaid');
    if (unpaidEntries.length === 1 && !kept) {
      void voidTransaction(unpaidEntries[0]!.id, 'Снята отметка «пришёл»');
    }
  };

  const handleFileChange = (file: File | undefined) => {
    if (!file || photoBusy) return;
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    setPhotoBusy(true);
    void fileToTournamentImageUrl(file)
      .then((imageUrl) => patch({ imageUrl }))
      .catch((error: unknown) => {
        window.alert(error instanceof Error ? error.message : 'Не удалось сохранить фото');
      })
      .finally(() => {
        setPhotoPreview(null);
        setPhotoBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      });
  };

  const addParticipant = (id: string, nickname: string, options?: { guest?: boolean }) => {
    const guest = options?.guest === true;
    if (linkingId && !guest) {
      const guestSeat = tournament.participants.find((p) => p.id === linkingId);
      const user = clubUsers.find((row) => row.id === id);
      if (!guestSeat || !user) return;
      const rebound = tournament.participants.map((p) =>
        p.id === linkingId
          ? {
              ...p,
              id: user.id,
              userId: user.id,
              nickname: user.nickname,
              equippedAvatar: user.equippedAvatar,
            }
          : p,
      );
      const guestKey = guestSeatKey(guestSeat.id);
      const hadEntry = transactions.some(
        (tx) =>
          tx.tournamentId === tournament.id &&
          tx.userId === guestKey &&
          !tx.voidedAt &&
          (tx.type === 'buy-in' || tx.type === 'ticket'),
      );
      void patch({
        participants: rebindTeamPartnerIdentity(rebound, linkingId, user.id),
      }).then((saved) => {
        if (!saved) return;
        if (isArrivedPlayer(guestSeat) && !hadEntry) ensureArrivalEntry(user.id);
        return refreshFinance();
      });
      setLinkingId(null);
      setAddOpen(false);
      return;
    }
    if (
      tournament.participants.some(
        (p) =>
          p.id === id ||
          sanitizeParticipantUserId(p.userId ?? '') === id ||
          p.nickname.trim().toLowerCase() === nickname.trim().toLowerCase(),
      )
    ) {
      return;
    }
    const seasonById = seasonPointsByUserId(clubUsers, tournaments);
    // Bust-out places follow the cashier field size, so a late entry re-opens
    // the bottom place as soon as the new seat is checked in.
    const nextParticipants = alignBustOutPlaces(
      [
        ...tournament.participants,
        {
          id,
          nickname: nickname.trim(),
          rating: guest ? 0 : (seasonById.get(id) ?? 0),
          userId: guest ? null : id,
          arrived: false,
        },
      ],
      tournament,
    );
    void patch({
      participants: nextParticipants,
      ...(nextParticipants.length > tournament.totalSeats
        ? { totalSeats: nextParticipants.length }
        : {}),
    });
    setAddOpen(false);
  };

  const addGuestByNickname = (raw: string) => {
    const nickname = normalizeGuestNickname(raw);
    if (!nickname) {
      window.alert(`Введите ник игрока (от 2 до ${GUEST_NICKNAME_MAX} символов)`);
      return;
    }
    const existingClub = clubUsers.find(
      (user) => user.nickname.trim().toLowerCase() === nickname.toLowerCase(),
    );
    if (existingClub) {
      addParticipant(existingClub.id, existingClub.nickname);
      return;
    }
    if (
      tournament.participants.some(
        (p) => p.nickname.trim().toLowerCase() === nickname.toLowerCase(),
      )
    ) {
      window.alert('Игрок с таким ником уже в турнире');
      return;
    }
    const id = guestParticipantId(
      nickname,
      tournament.participants.map((p) => p.id),
    );
    addParticipant(id, nickname, { guest: true });
  };

  const toggleArrived = (id: string) => {
    const player = tournament.participants.find((p) => p.id === id);
    if (!player) return;
    const arrived = isArrivedPlayer(player);
    if (arrived && typeof player.place === 'number') {
      window.alert('Нельзя снять отметку: игрок уже выбыл в кассе');
      return;
    }
    const toggled = tournament.participants.map((p) => (p.id === id ? { ...p, arrived: !arrived } : p));
    const next = arrived ? setTeamPartner(toggled, id, null, tournament.id) : toggled;
    void patch({
      participants: alignBustOutPlaces(next, tournament),
    });
    if (arrived) dropLoneArrivalEntry(player.userId ?? player.id);
    else ensureArrivalEntry(player.userId ?? player.id);
  };

  const removeParticipant = (id: string) => {
    if (pairingPlayerId === id) setPairingPlayerId(null);
    patch({
      participants: alignBustOutPlaces(
        removeSeatKeepingTeams(tournament.participants, id, tournament.id),
        tournament,
      ),
    });
  };

  const distributeTeams = () => {
    const arrived = tournament.participants.filter(isArrivedPlayer);
    if (arrived.length < 2) {
      window.alert('Отметьте в кассе хотя бы двух игроков');
      return;
    }
    if (hasAnyTeamPair(tournament.participants)) {
      window.alert('Команды уже распределены. Нажмите кнопку пары у игрока, чтобы сменить сокомандника.');
      return;
    }
    if (!window.confirm('Случайно распределить пары среди игроков, которые пришли на турнир?')) {
      return;
    }
    void patch({
      participants: assignRandomTeamPairs(tournament.participants, tournament.id),
    });
  };

  const pickPartner = (playerId: string, partnerId: string) => {
    void patch({
      participants: setTeamPartner(tournament.participants, playerId, partnerId, tournament.id),
    });
    setPairingPlayerId(null);
  };

  const clearPartner = (playerId: string) => {
    void patch({
      participants: setTeamPartner(tournament.participants, playerId, null, tournament.id),
    });
    setPairingPlayerId(null);
  };

  const handleCopy = async (includeParticipants: boolean) => {
    if (copying) return;
    setCopying(true);
    const newId = await duplicateTournament(tournament.id, { includeParticipants });
    setCopying(false);
    if (!newId) return;
    setCopyOpen(false);
    navigate(`/admin/tournaments/${newId}`);
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    const ok = await deleteTournament(tournament.id);
    setDeleting(false);
    if (!ok) return;
    setDeleteOpen(false);
    navigate('/admin/tournaments');
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <button
        type="button"
        onClick={() => navigate('/admin/tournaments')}
        className="absolute top-2 left-2 z-50 w-10 h-10 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(28,20,16,0.78)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(217,153,98,0.28)',
        }}
      >
        <ArrowLeft size={20} strokeWidth={2.2} style={{ color: '#D99962' }} />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFileChange(e.target.files?.[0]);
          e.currentTarget.value = '';
        }}
      />

      <div
        className="flex-1 scrollable"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        <EditableHero
          tournament={tournament}
          photoOverride={photoPreview}
          photoBusy={photoBusy}
          onPatch={patch}
          onPickPhoto={() => {
            if (!photoBusy) fileInputRef.current?.click();
          }}
        />

        <div className="px-5 pt-4 space-y-5">
          {/* Seats — occupied is always derived from the participant list */}
          <div className="rounded-2xl p-4 space-y-3" style={CARD_STYLE}>
            <h3 className={SECTION_TITLE} style={{ color: '#F2D8A7' }}>
              Места
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-[11px] font-600 mb-1" style={{ color: '#A39B98' }}>
                  Всего
                </p>
                <EditableText
                  value={String(tournament.totalSeats)}
                  onSave={(v) => patch({ totalSeats: Number(v) || DEFAULT_TOTAL_SEATS })}
                  type="number"
                  renderValue={(v) => (
                    <span className="text-white font-800 text-[18px]">{v}</span>
                  )}
                />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-600 mb-1" style={{ color: '#A39B98' }}>
                  Занято
                </p>
                <span className="text-white font-800 text-[18px]">{occupiedSeats}</span>
                <p className="text-[10px] font-500 mt-0.5" style={{ color: '#6B6360' }}>
                  по списку участников
                </p>
              </div>
            </div>
          </div>

          {/* Guarantee */}
          <div className="relative rounded-2xl overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.12]"
              style={{ background: 'linear-gradient(to right, #D99962, #F2D8A7)' }}
            />
            <div
              className="relative flex items-center gap-4 px-5 py-4 rounded-2xl"
              style={{ border: '1px solid rgba(242,216,167,0.32)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(to right, #D99962, #F2D8A7)' }}
              >
                <Star size={20} fill="currentColor" style={{ color: '#0A0908' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[11px] font-600 uppercase tracking-[0.12em] mb-0.5"
                  style={{ color: '#A39B98' }}
                >
                  Гарантия очков
                </p>
                <EditableText
                  value={String(tournament.guarantee)}
                  onSave={(v) => patch({ guarantee: Number(v) || 0 })}
                  type="number"
                  renderValue={(v) => (
                    <span className="text-white font-900 text-[24px] tracking-wide leading-tight">
                      {Number(v).toLocaleString('ru-RU')}
                    </span>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-4 space-y-4" style={CARD_STYLE}>
            <BountyCheckbox
              checked={tournament.isBounty === true}
              onChange={(checked) => patch({ isBounty: checked })}
            />
            <BlindStructurePicker
              structureId={tournament.blindStructureId}
              structureName={tournament.blindStructure}
              onChange={(next) => patch(next)}
            />
            {!isFinished && (
              <button
                type="button"
                onClick={() => openTimerForTournament(tournament.id)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-700 text-[#0A0908] active:scale-[0.98] transition-transform"
                style={{
                  background: 'linear-gradient(to right, #8C4C27, #D99962)',
                  boxShadow: '0 0 16px rgba(217,153,98,0.28)',
                }}
              >
                <Timer size={16} strokeWidth={2.4} />
                Запустить таймер
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate(`/admin/finance/tournaments/${tournament.id}`)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-700 active:scale-[0.98] transition-transform"
              style={{
                background: 'rgba(217,153,98,0.12)',
                border: '1px solid rgba(217,153,98,0.4)',
                color: '#F2D8A7',
              }}
            >
              <Wallet size={16} strokeWidth={2.4} />
              Касса турнира
            </button>
          </div>

          {/* Info */}
          <div className="rounded-2xl p-5 space-y-5" style={CARD_STYLE}>
            <section>
              <h3 className={`${SECTION_TITLE} mb-3`} style={{ color: '#F2D8A7' }}>
                О турнире
              </h3>
              <EditableText
                value={tournament.about}
                onSave={(v) => patch({ about: v })}
                multiline
                rows={6}
                placeholder="Расскажите об этом турнире"
                renderValue={(v) => (
                  <p
                    className="text-[13px] font-400 leading-relaxed whitespace-pre-wrap break-words"
                    style={{ color: v ? '#A39B98' : '#6B6360' }}
                  >
                    {v || 'Описание не заполнено'}
                  </p>
                )}
              />
            </section>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

            <section>
              <h3 className={`${SECTION_TITLE} mb-3`} style={{ color: '#F2D8A7' }}>
                Особенности (пунктами)
              </h3>
              <FeatureListEditor
                features={tournament.features}
                onChange={(features) => patch({ features })}
              />
            </section>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

            <section>
              <h3 className={`${SECTION_TITLE} mb-3`} style={{ color: '#F2D8A7' }}>
                Адрес
              </h3>
              <EditableText
                value={tournament.address}
                onSave={(v) => patch({ address: v })}
                placeholder="Адрес проведения"
                renderValue={(v) => (
                  <p className="text-[13px] font-400" style={{ color: '#A39B98' }}>
                    {v || 'Адрес не указан'}
                  </p>
                )}
              />
            </section>
          </div>

          <ParticipantsEditor
            participants={tournament.participants}
            totalSeats={tournament.totalSeats}
            clubUsers={clubUsers}
            tournamentId={tournament.id}
            teamBattle={teamBattle}
            pairingEnabled={!isFinished}
            pairingPlayerId={pairingPlayerId}
            addOpen={addOpen}
            linkingNickname={linkingPlayer?.nickname}
            pickerUsers={pickerUsers}
            onToggleAdd={() => {
              setAddOpen((open) => {
                const next = !open;
                if (!next) setLinkingId(null);
                return next;
              });
            }}
            onPickUser={(user) => addParticipant(user.id, user.nickname)}
            onAddGuestNick={addGuestByNickname}
            onToggleArrived={toggleArrived}
            onBindGuest={(id) => {
              setLinkingId(id);
              setAddOpen(true);
            }}
            onRemove={removeParticipant}
            onDistributeTeams={distributeTeams}
            onStartPairing={(id) => setPairingPlayerId((current) => (current === id ? null : id))}
            onPickPartner={pickPartner}
            onClearPartner={clearPartner}
          />

          <button
            type="button"
            onClick={() => setCopyOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[15px] font-700 text-white bg-[#463129] active:scale-[0.98] transition-transform"
            style={{ border: '1px solid #D99962' }}
          >
            Скопировать турнир
          </button>

          <button
            type="button"
            onClick={() => {
              const hide = tournament.hidden !== true;
              const ok = window.confirm(
                hide
                  ? 'Скрыть турнир из списка игроков? Состав, касса и история сохранятся. Игроки не увидят его в текущих и прошедших.'
                  : 'Вернуть турнир в общий список игроков?',
              );
              if (ok) void patch({ hidden: hide });
            }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[15px] font-700 text-white active:scale-[0.98] transition-transform"
            style={{ background: '#463129', border: '1px solid #D99962' }}
          >
            {tournament.hidden ? <Eye size={16} strokeWidth={2.4} /> : <EyeOff size={16} strokeWidth={2.4} />}
            {tournament.hidden ? 'Показать турнир' : 'Скрыть турнир'}
          </button>

          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[15px] font-700 text-white active:scale-[0.98] transition-transform"
            style={{ background: 'rgba(127,29,29,0.35)', border: '1px solid rgba(248,113,113,0.45)' }}
          >
            <Trash2 size={16} strokeWidth={2.4} />
            Удалить турнир
          </button>
        </div>
      </div>

      <CopyTournamentModal
        open={copyOpen}
        busy={copying}
        playerCount={copyPlayerCount}
        onClose={() => {
          if (!copying) setCopyOpen(false);
        }}
        onCopyWithPlayers={() => void handleCopy(true)}
        onCopyWithoutPlayers={() => void handleCopy(false)}
      />
      <DeleteTournamentModal
        open={deleteOpen}
        busy={deleting}
        closed={isFinished}
        title={tournament.title}
        onClose={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

export function AdminTournamentEditor() {
  const { id } = useParams<{ id: string }>();
  const { tournaments, isLoading, loadError, fetchTournaments } = useTournaments();

  const tournament = tournaments.find((t) => t.id === id);
  if (!tournament && isLoading) {
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
        <ScreenLoading label="Загрузка турнира…" />
      </div>
    );
  }
  if (!tournament && loadError) {
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
        <FetchErrorCard message={loadError} onRetry={() => void fetchTournaments()} />
      </div>
    );
  }
  if (!tournament) return <Navigate to="/admin/tournaments" replace />;

  return <Editor tournament={tournament} />;
}
