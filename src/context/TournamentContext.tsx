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
  deleteParticipantSeat,
  deleteTournamentRow,
  fetchParticipants,
  fetchTournaments as loadTournaments,
  insertParticipantRow,
  insertTournament,
  syncParticipantRows,
  updateTournamentRow,
} from '../lib/tournamentApi';
import { participantToRow } from '../lib/supabaseMap';
import { getClubDirectory } from '../lib/clubDirectory';

/** Legacy seat id for the signed-in player; new rows use the real user id. */
export const CURRENT_USER_ID = 'me';

interface TournamentContextValue {
  tournaments: Tournament[];
  isLoading: boolean;
  fetchTournaments: () => Promise<void>;
  refreshParticipants: (tournamentId: string) => Promise<void>;
  toggleRegistration: (tournamentId: string) => Promise<void>;
  isRegistered: (tournamentId: string) => boolean;
  updateTournament: (tournamentId: string, patch: Partial<Tournament>) => Promise<void>;
  addTournament: (tournament: Omit<Tournament, 'id'>) => Promise<string>;
  deleteTournament: (tournamentId: string) => Promise<void>;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

function isSeatOfUser(player: Participant, userId: string): boolean {
  return player.id === userId || player.id === CURRENT_USER_ID;
}

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const { account, userId, isLoading: userLoading } = useUser();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const resolveUserId = useCallback(
    (player: Participant): string | null => {
      if (player.id === CURRENT_USER_ID) return userId || null;
      if (getClubDirectory().some((user) => user.id === player.id)) return player.id;
      return player.id || null;
    },
    [userId],
  );

  const fetchTournaments = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await loadTournaments();
      setTournaments(rows);
    } catch (error) {
      console.error(error);
      setTournaments([]);
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
      if (!account || !userId) return;
      const tournament = tournaments.find((row) => row.id === tournamentId);
      if (!tournament || tournament.isClosed) return;

      const seated = tournament.participants.some((player) => isSeatOfUser(player, userId));
      try {
        if (seated) {
          await deleteParticipantSeat(tournamentId, userId);
          setTournaments((prev) =>
            prev.map((row) =>
              row.id !== tournamentId
                ? row
                : {
                    ...row,
                    participants: row.participants.filter((player) => !isSeatOfUser(player, userId)),
                  },
            ),
          );
          return;
        }
        if (tournament.participants.length >= tournament.totalSeats) return;
        const player: Participant = {
          id: userId,
          nickname: account.nickname,
          rating: 0,
        };
        await insertParticipantRow(participantToRow(tournamentId, player, userId));
        setTournaments((prev) =>
          prev.map((row) =>
            row.id !== tournamentId ? row : { ...row, participants: [...row.participants, player] },
          ),
        );
        await refreshParticipants(tournamentId);
      } catch (error) {
        console.error(error);
        window.alert(error instanceof Error ? error.message : 'Не удалось обновить запись');
      }
    },
    [account, refreshParticipants, tournaments, userId],
  );

  const updateTournament = useCallback(
    async (tournamentId: string, patch: Partial<Tournament>) => {
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
          );
        }
        setTournaments((prev) => prev.map((row) => (row.id === tournamentId ? next : row)));
      } catch (error) {
        console.error(error);
        window.alert(error instanceof Error ? error.message : 'Не удалось сохранить турнир');
      }
    },
    [resolveUserId, tournaments],
  );

  const addTournament = useCallback(
    async (tournament: Omit<Tournament, 'id'>) => {
      const id = `t-${Date.now()}`;
      const created: Tournament = { ...tournament, id, participants: tournament.participants ?? [] };
      try {
        const saved = await insertTournament(created);
        if (created.participants.length > 0) {
          saved.participants = await syncParticipantRows(
            saved.id,
            [],
            created.participants,
            resolveUserId,
          );
        }
        setTournaments((prev) => [saved, ...prev]);
        return saved.id;
      } catch (error) {
        console.error(error);
        window.alert(error instanceof Error ? error.message : 'Не удалось создать турнир');
        return '';
      }
    },
    [resolveUserId],
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

  const value = useMemo<TournamentContextValue>(
    () => ({
      tournaments,
      isLoading: isLoading || userLoading,
      fetchTournaments,
      refreshParticipants,
      toggleRegistration,
      isRegistered,
      updateTournament,
      addTournament,
      deleteTournament,
    }),
    [
      addTournament,
      deleteTournament,
      fetchTournaments,
      isLoading,
      isRegistered,
      refreshParticipants,
      toggleRegistration,
      tournaments,
      updateTournament,
      userLoading,
    ],
  );

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}

export function useTournaments() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournaments must be used within TournamentProvider');
  return ctx;
}
