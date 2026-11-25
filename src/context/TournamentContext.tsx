import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Participant, Tournament } from '../types/tournament';
import { useUser } from './UserContext';
import {
  fetchParticipants,
  fetchParticipantFaces,
  fetchParticipantsByTournament,
  fetchTournaments as loadTournaments,
  insertTournament,
  participantListsEqual,
  syncParticipantRows,
  updateTournamentRow,
  deleteTournamentRow,
} from '../lib/tournamentApi';
import { resetCopiedParticipant, sanitizeParticipantUserId } from '../lib/supabaseMap';
import { clubUserIdSet, lobbySeatedPlayers } from '../lib/clubRating';
import { usePersonnel } from '../hooks/usePersonnel';
import { withPersonnel, type PersonnelIntent, type PersonnelRoster } from '../lib/personnel';
import { setTournamentRegistration } from '../lib/tournamentRegistration';
import { requestErrorMessage } from '../lib/network';
import { saveTournamentOverlay as saveTournamentOverlayRow } from '../lib/tournamentOverlayApi';
import { saveTournamentClock } from '../lib/tournamentClockApi';
import type { FinishForecastMark } from '../lib/finishForecastLog';

/** Legacy seat id for the signed-in player; new rows use the real user id. */
export const CURRENT_USER_ID = 'me';

interface TournamentContextValue {
  tournaments: Tournament[];
  isLoading: boolean;
  loadError: string | null;
  fetchTournaments: () => Promise<void>;
  loadAllRosters: () => Promise<void>;
  refreshParticipants: (tournamentId: string) => Promise<boolean>;
  toggleRegistration: (tournamentId: string) => Promise<void>;
  isRegistered: (tournamentId: string) => boolean;
  updateTournament: (tournamentId: string, patch: Partial<Tournament>) => Promise<boolean>;
  addTournament: (tournament: Omit<Tournament, 'id'>) => Promise<string>;
  duplicateTournament: (
    sourceId: string,
    options: { includeParticipants: boolean },
  ) => Promise<string>;
  deleteTournament: (tournamentId: string) => Promise<boolean>;
  saveTournamentOverlay: (tournamentId: string, base: number, perHead: number) => Promise<boolean>;
  savePlayedClock: (tournamentId: string, start: string, end: string) => Promise<boolean>;
  rememberFinishForecasts: (tournamentId: string, marks: FinishForecastMark[]) => void;
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
  const { account, userId, clubUsers, isAdmin } = useUser();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const personnel = usePersonnel(account?.id ?? '', account?.role);
  const rosterFetchGen = useRef<Record<string, number>>({});
  const tournamentsRef = useRef<Tournament[]>([]);
  tournamentsRef.current = tournaments;
  const visibleTournaments = useMemo(() => {
    const rows = tournaments.map((row) => withPersonnel(row, personnel.rosters[row.id]));
    return isAdmin ? rows : rows.filter((row) => row.hidden !== true);
  }, [isAdmin, tournaments, personnel.rosters]);

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
      setTournaments((prev) => rows.map((row) => {
        const current = prev.find((tournament) => tournament.id === row.id);
        if (!current?.rosterLoaded) return row;
        return { ...row, participants: current.participants, rosterLoaded: true };
      }));
    } catch (error) {
      console.error(error);
      setTournaments([]);
      setLoadError(
        requestErrorMessage(
          error,
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить турниры. Проверьте интернет.',
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTournaments();
  }, [fetchTournaments]);

  const applyRoster = useCallback((tournamentId: string, participants: Participant[], gen: number) => {
    if (rosterFetchGen.current[tournamentId] !== gen) return false;
    const current = tournamentsRef.current.find((tournament) => tournament.id === tournamentId);
    if (!current) return false;
    const suspiciousEmpty =
      participants.length === 0 &&
      (current.occupiedCount ?? 0) > 0 &&
      current.participants.length === 0;
    if (suspiciousEmpty) return false;
    setTournaments((prev) => {
      const row = prev.find((tournament) => tournament.id === tournamentId);
      if (!row) return prev;
      if (
        participants.length === 0 &&
        (row.occupiedCount ?? 0) > 0 &&
        row.participants.length === 0
      ) {
        return prev;
      }
      if (row.rosterLoaded && participantListsEqual(row.participants, participants)) return prev;
      return prev.map((tournament) =>
        tournament.id === tournamentId
          ? { ...tournament, participants, rosterLoaded: true }
          : tournament,
      );
    });
    return true;
  }, []);

  const refreshParticipants = useCallback(async (tournamentId: string) => {
    const gen = (rosterFetchGen.current[tournamentId] ?? 0) + 1;
    rosterFetchGen.current[tournamentId] = gen;
    try {
      const participants = await fetchParticipants(tournamentId);
      if (rosterFetchGen.current[tournamentId] !== gen) return false;
      const applied = applyRoster(tournamentId, participants, gen);
      if (!applied) return false;
      void fetchParticipantFaces(tournamentId).then((faces) => {
        if (!faces) return;
        applyRoster(tournamentId, faces, gen);
      });
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }, [applyRoster]);

  const loadAllRosters = useCallback(async () => {
    try {
      const grouped = await fetchParticipantsByTournament();
      setTournaments((prev) => {
        if (
          grouped.size === 0 &&
          prev.some((row) => (row.occupiedCount ?? 0) > 0 || row.participants.length > 0)
        ) {
          return prev;
        }
        return prev.map((tournament) => {
          const next = grouped.get(tournament.id);
          if (!next && (tournament.occupiedCount ?? 0) > 0) return tournament;
          return {
            ...tournament,
            participants: next ?? [],
            rosterLoaded: true,
          };
        });
      });
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
      if (tournament.isClosed || tournament.hidden) {
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
        return false;
      }
      if ('isClosed' in patch || 'resultsEntered' in patch || 'rubiesDistributed' in patch) {
        window.alert('Закрытие и начисления выполняются только отдельной серверной командой');
        return false;
      }
      if (!account?.id) {
        window.alert('Не удалось подтвердить администратора');
        return false;
      }
      const current = tournaments.find((row) => row.id === tournamentId);
      if (!current) return false;
      const { participants,staff:_staff,dealers:_dealers,results:_results,
        isClosed:_isClosed,resultsEntered:_resultsEntered,rubiesDistributed:_rubiesDistributed,
        id:_id,...metadataPatch }=patch;
      let confirmedParticipants:Participant[]|undefined;
      try {
        if(Object.keys(metadataPatch).length>0) {
          await updateTournamentRow(tournamentId,metadataPatch,account.id);
        }
        if (participants) {
          confirmedParticipants = await syncParticipantRows(
            tournamentId,
            current.participants,
            participants,
            resolveUserId,
            account.id,
            { isClosed: current.isClosed === true },
          );
          rosterFetchGen.current[tournamentId] = (rosterFetchGen.current[tournamentId] ?? 0) + 1;
        }
        setTournaments((prev) => prev.map((row) => row.id === tournamentId ? {
          ...row,...metadataPatch,
          ...(confirmedParticipants?{participants:confirmedParticipants}:{}),
        }:row));
      } catch (error) {
        console.error(error);
        window.alert(error instanceof Error ? error.message : 'Не удалось сохранить турнир');
        return false;
      }
      return true;
    },
    [account, resolveUserId, tournaments],
  );

  const addTournament = useCallback(
    async (tournament: Omit<Tournament, 'id'>) => {
      const id = `t-${Date.now()}`;
      const created: Tournament = { ...tournament, id, participants: tournament.participants ?? [] };
      try {
        const saved = await insertTournament(created,account?.id ?? '');
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
      const guarantee = current.overlayBase ?? current.guarantee;
      const newId = await addTournament({
        ...rest,
        title: `${current.title} Copy`,
        guarantee,
        overlayBase: undefined,
        overlayPerHead: undefined,
        participants: copiedSeats,
        features: [...current.features],
        isClosed: false,
        hidden: true,
        rubiesDistributed: false,
        resultsEntered: false,
        adminSecretComment: '',
        dealers: undefined,
        staff: undefined,
        results: undefined,
      });
      if (!newId) return '';
      try {
        const saved = await saveTournamentOverlayRow(newId, guarantee, 0);
        setTournaments((prev) => prev.map((row) => (
          row.id === newId
            ? {
                ...row,
                hidden: true,
                guarantee: saved.guarantee,
                overlayBase: saved.overlayBase,
                overlayPerHead: saved.overlayPerHead,
              }
            : row
        )));
      } catch (error) {
        console.error(error);
        window.alert('Копия создана скрытой, но оверлей не удалось отключить');
      }
      return newId;
    },
    [addTournament, clubUsers, tournaments],
  );

  const savePlayedClock = useCallback(
    async (tournamentId: string, start: string, end: string) => {
      if (!account?.id) {
        window.alert('Не удалось подтвердить администратора');
        return false;
      }
      try {
        const saved = await saveTournamentClock(tournamentId, start, end);
        setTournaments((prev) => prev.map((row) => (
          row.id === tournamentId
            ? { ...row, playedStart: saved.playedStart, playedEnd: saved.playedEnd }
            : row
        )));
        return true;
      } catch (error) {
        console.error(error);
        window.alert(error instanceof Error ? error.message : 'Не удалось сохранить начало и конец');
        return false;
      }
    },
    [account?.id],
  );

  const rememberFinishForecasts = useCallback((tournamentId: string, marks: FinishForecastMark[]) => {
    setTournaments((prev) => prev.map((row) => (
      row.id === tournamentId ? { ...row, finishForecasts: marks } : row
    )));
  }, []);

  const deleteTournament = useCallback(
    async (tournamentId: string) => {
      if (!account?.id) {
        window.alert('Не удалось подтвердить администратора');
        return false;
      }
      try {
        await deleteTournamentRow(tournamentId, account.id);
        setTournaments((prev) => prev.filter((row) => row.id !== tournamentId));
        return true;
      } catch (error) {
        console.error(error);
        window.alert(error instanceof Error ? error.message : 'Не удалось удалить турнир');
        return false;
      }
    },
    [account?.id],
  );

  const saveTournamentOverlay = useCallback(
    async (tournamentId: string, base: number, perHead: number) => {
      if (!account?.id) {
        window.alert('Не удалось подтвердить администратора');
        return false;
      }
      try {
        const saved = await saveTournamentOverlayRow(tournamentId, base, perHead);
        setTournaments((prev) => prev.map((row) => (
          row.id === tournamentId
            ? {
                ...row,
                guarantee: saved.guarantee,
                overlayBase: saved.overlayBase,
                overlayPerHead: saved.overlayPerHead,
              }
            : row
        )));
        return true;
      } catch (error) {
        console.error(error);
        window.alert(error instanceof Error ? error.message : 'Не удалось сохранить оверлей');
        return false;
      }
    },
    [account?.id],
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchTournaments(), personnel.refresh()]);
  }, [fetchTournaments, personnel.refresh]);

  const value = useMemo<TournamentContextValue>(
    () => ({
      tournaments: visibleTournaments,
      isLoading: isLoading || personnel.isLoading,
      loadError: loadError ?? personnel.error,
      fetchTournaments: refreshAll,
      loadAllRosters,
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
      saveTournamentOverlay,
      savePlayedClock,
      rememberFinishForecasts,
    }),
    [
      addTournament,
      duplicateTournament,
      deleteTournament,
      saveTournamentOverlay,
      savePlayedClock,
      rememberFinishForecasts,
      fetchTournaments,
      isLoading,
      loadError,
      isRegistered,
      loadAllRosters,
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

export function useFullTournamentRosters() {
  const { loadAllRosters } = useTournaments();
  useEffect(() => {
    void loadAllRosters();
  }, [loadAllRosters]);
}

export function useTournaments() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournaments must be used within TournamentProvider');
  return ctx;
}
