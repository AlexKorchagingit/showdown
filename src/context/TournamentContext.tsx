import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Participant, Tournament } from '../types/tournament';
import { useUser } from './UserContext';
import {
  deleteTournamentRow,
  fetchParticipants,
  fetchTournaments as loadTournaments,
  insertTournament,
  syncParticipantRows,
  updateTournamentRow,
} from '../lib/tournamentApi';
import { resetCopiedParticipant, sanitizeParticipantUserId } from '../lib/supabaseMap';
import { clubUserIdSet, lobbySeatedPlayers } from '../lib/clubRating';
import { usePersonnel } from '../hooks/usePersonnel';
import { withPersonnel, type PersonnelIntent, type PersonnelRoster } from '../lib/personnel';
import { setTournamentRegistration } from '../lib/tournamentRegistration';

/** Legacy seat id for the signed-in player; new rows use the real user id. */
export const CURRENT_USER_ID = 'me';

interface TournamentContextValue {
  tournaments: Tournament[];
  isLoading: boolean;
  loadError: string | null;
  fetchTournaments: () => Promise<void>;
  refreshParticipants: (tournamentId: string) => Promise<void>;
  toggleRegistration: (tournamentId: string) => Promise<void>;
  isRegistered: (tournamentId: string) => boolean;
  updateTournament: (tournamentId: string, patch: Partial<Tournament>) => Promise<void>;
  addTournament: (tournament: Omit<Tournament, 'id'>) => Promise<string>;
  duplicateTournament: (
    sourceId: string,
    options: { includeParticipants: boolean },
  ) => Promise<string>;
  deleteTournament: (tournamentId: string) => Promise<void>;
  personnelRosters: Record<string, PersonnelRoster>;
  personnelCommand: (intent: PersonnelIntent) => Promise<boolean>;
  isPersonnelPending: (tournamentId: string) => boolean;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

function isSeatOfUser(player: Participant, userId: string): boolean {
  return (
    player.id === userId ||
    player.userId === userId ||
    player.id === CURRENT_USER_ID
  );
}

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const { account, userId, clubUsers } = useUser();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const personnel = usePersonnel(account?.id ?? '', account?.role);
  const visibleTournaments = useMemo(() => tournaments.map((row) => withPersonnel(row, personnel.rosters[row.id])),
    [tournaments, personnel.rosters]);

  const resolveUserId = useCallback(
    (player: Participant): string | null => {
      const bound = sanitizeParticipantUserId(player.userId ?? '');
      if (bound) return bound;
      if (player.id === CURRENT_USER_ID) return sanitizeParticipantUserId(userId);
      if (player.id.includes(':')) return null;
      return sanitizeParticipantUserId(player.id);
    },
    [userId],
  );

  const fetchTournaments = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const rows = await loadTournaments();
      setTournaments(rows);
    } catch (error) {
      console.error(error);
      setTournaments([]);
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить турниры. Проверьте интернет.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTournaments();
  }, [fetchTournaments]);

  const refreshParticipants = useCallback(async (tournamentId: string) => {
    try {
      const participants = await fetchParticipants(tournamentId);
      setTournaments((prev) =>
        prev.map((tournament) =>
          tournament.id === tournamentId ? { ...tournament, participants } : tournament,
        ),
      );
    } catch (error) {
      console.error(error);
    }
  }, []);

  const isRegistered = useCallback(
    (tournamentId: string) => {
      if (!userId) return false;
      const tournament = tournaments.find((row) => row.id === tournamentId);
      return Boolean(tournament?.participants.some((player) => isSeatOfUser(player, userId)));
    },
    [tournaments, userId],
  );

  const toggleRegistration = useCallback(
    async (tournamentId: string) => {
      if (!account) {
        window.alert('Сначала войдите в аккаунт');
        return;
      }
      if (!userId) {
        window.alert('Не удалось определить игрока');
        return;
      }
      const tournament = tournaments.find((row) => row.id === tournamentId);
      if (!tournament) {
        window.alert('Турнир не найден');
        return;
      }
      if (tournament.isClosed) {
        window.alert('Регистрация закрыта');
        return;
      }

      let liveSeats = tournament.participants;
      try {
        liveSeats = await fetchParticipants(tournamentId);
      } catch (error) {
        console.error(error);
      }

      const seated = liveSeats.some((player) => isSeatOfUser(player, userId));
      try {
        await setTournamentRegistration(account.id, tournamentId, !seated);
        await refreshParticipants(tournamentId);
      } catch (error) {
        console.error(error);
        await refreshParticipants(tournamentId);
        window.alert(error instanceof Error ? error.message : 'Не удалось обновить запись');
      }
    },
    [account, refreshParticipants, tournaments, userId],
  );

  const updateTournament = useCallback(
    async (tournamentId: string, patch: Partial<Tournament>) => {
      if ('staff' in patch || 'dealers' in patch) {
        window.alert('Персонал изменяется только отдельной серверной командой');
        return;
      }
      const current = tournaments.find((row) => row.id === tournamentId);
      if (!current) return;
      const next = { ...current, ...patch };
      try {
        await updateTournamentRow(next);
        if (patch.participants) {
          next.participants = await syncParticipantRows(
            tournamentId,
            current.participants,
            patch.participants,
            resolveUserId,
            account?.id ?? '',
          );
        }
        setTournaments((prev) => prev.map((row) => (row.id === tournamentId ? next : row)));
      } catch (error) {
        console.error(error);
        window.alert(error instanceof Error ? error.message : 'Не удалось сохранить турнир');
      }
    },
    [account?.id, resolveUserId, tournaments],
  );

  const addTournament = useCallback(
    async (tournament: Omit<Tournament, 'id'>) => {
      const id = `t-${Date.now()}`;
      const created: Tournament = { ...tournament, id, participants: tournament.participants ?? [] };
      try {
        const saved = await insertTournament(created);
        try {
          if (created.participants.length > 0) {
            saved.participants = await syncParticipantRows(
              saved.id,
              [],
              created.participants,
              resolveUserId,
              account?.id ?? '',
            );
          }
        } catch (seatError) {
          console.error(seatError);
          try {
            saved.participants = await fetchParticipants(saved.id);
          } catch {
            saved.participants = [];
          }
          setTournaments((prev) => [saved, ...prev]);
          window.alert(
            seatError instanceof Error
              ? `Турнир создан, но состав не записался: ${seatError.message}`
              : 'Турнир создан, но состав не записался',
          );
          return saved.id;
        }
        setTournaments((prev) => [saved, ...prev]);
        return saved.id;
      } catch (error) {
        console.error(error);
        window.alert(error instanceof Error ? error.message : 'Не удалось создать турнир');
        return '';
      }
    },
    [account?.id, resolveUserId],
  );

  const duplicateTournament = useCallback(
    async (sourceId: string, options: { includeParticipants: boolean }) => {
      const current = tournaments.find((row) => row.id === sourceId);
      if (!current) {
        window.alert('Не удалось скопировать турнир');
        return '';
      }

      let copiedSeats: Participant[] = [];
      if (options.includeParticipants) {
        let seats = current.participants;
        try {
          const fetched = await fetchParticipants(sourceId);
          if (fetched.length > 0) seats = fetched;
        } catch (error) {
          console.error(error);
        }
        const knownIds = clubUserIdSet(clubUsers);
        copiedSeats = (
          knownIds.size > 0 ? lobbySeatedPlayers(seats, knownIds) : seats
        ).map(resetCopiedParticipant);
      }

      const { id: _id, ...rest } = current;
      return addTournament({
        ...rest,
        title: `${current.title} Copy`,
        participants: copiedSeats,
        features: [...current.features],
        isClosed: false,
        rubiesDistributed: false,
        resultsEntered: false,
        dealers: undefined,
        staff: undefined,
        results: undefined,
      });
    },
    [addTournament, clubUsers, tournaments],
  );

  const deleteTournament = useCallback(async (tournamentId: string) => {
    try {
      await deleteTournamentRow(tournamentId);
      setTournaments((prev) => prev.filter((row) => row.id !== tournamentId));
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : 'Не удалось удалить турнир');
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchTournaments(), personnel.refresh()]);
  }, [fetchTournaments, personnel.refresh]);

  const value = useMemo<TournamentContextValue>(
    () => ({
      tournaments: visibleTournaments,
      isLoading: isLoading || personnel.isLoading,
      loadError: loadError ?? personnel.error,
      fetchTournaments: refreshAll,
      personnelRosters: personnel.rosters,
      personnelCommand: personnel.command,
      isPersonnelPending: personnel.isPending,
      refreshParticipants,
      toggleRegistration,
      isRegistered,
      updateTournament,
      addTournament,
      duplicateTournament,
      deleteTournament,
    }),
    [
      addTournament,
      deleteTournament,
      duplicateTournament,
      fetchTournaments,
      isLoading,
      loadError,
      isRegistered,
      refreshParticipants,
      toggleRegistration,
      tournaments,
      updateTournament,
      visibleTournaments,
      personnel,
      refreshAll,
    ],
  );

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}

export function useTournaments() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournaments must be used within TournamentProvider');
  return ctx;
}
