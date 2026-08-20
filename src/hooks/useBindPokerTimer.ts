import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlinds } from '../context/BlindsContext';
import { useTournaments } from '../context/TournamentContext';
import {
  resolveStructureForTournament,
  timerPathForStructure,
  timerPathForTournament,
} from '../lib/timerTournament';

/** Bind the blinds timer to a TournamentContext row by id (never by title). */
export function useBindPokerTimer() {
  const navigate = useNavigate();
  const { tournaments } = useTournaments();
  const {
    structures,
    ensureTimer,
    setLinkedTournament,
    setTotalEntries,
    linkedTournamentId,
    activeStructureId,
  } = useBlinds();

  const bindTournament = useCallback(
    (tournamentId: string | null) => {
      const switching = tournamentId !== linkedTournamentId;
      if (switching) setLinkedTournament(tournamentId);
      if (!tournamentId) return;

      const tournament = tournaments.find((row) => row.id === tournamentId);
      if (!tournament) return;

      const structure = resolveStructureForTournament(tournament, structures);
      if (structure && structure.id !== activeStructureId) ensureTimer(structure.id);
      if (switching) setTotalEntries(tournament.participants.length);
    },
    [
      tournaments,
      structures,
      ensureTimer,
      setLinkedTournament,
      setTotalEntries,
      linkedTournamentId,
      activeStructureId,
    ],
  );

  const openTimerForTournament = useCallback(
    (tournamentId: string) => {
      bindTournament(tournamentId);
      navigate(timerPathForTournament(tournamentId));
    },
    [bindTournament, navigate],
  );

  const openTimerForStructure = useCallback(
    (structureId: string) => {
      const structure = structures.find((row) => row.id === structureId);
      const linked = tournaments.find((row) => row.id === linkedTournamentId);
      const linkedUsesStructure =
        Boolean(structure) &&
        Boolean(linked) &&
        resolveStructureForTournament(linked, structures)?.id === structureId;

      if (linked && linkedUsesStructure && !linked.isClosed) {
        openTimerForTournament(linked.id);
        return;
      }

      const matches = structure
        ? tournaments.filter((tournament) => {
            if (tournament.isClosed) return false;
            if (tournament.blindStructureId === structure.id) return true;
            return tournament.blindStructure.trim() === structure.name;
          })
        : [];

      if (matches.length === 1) {
        openTimerForTournament(matches[0].id);
        return;
      }

      ensureTimer(structureId);
      navigate(timerPathForStructure(structureId));
    },
    [
      structures,
      tournaments,
      linkedTournamentId,
      ensureTimer,
      navigate,
      openTimerForTournament,
    ],
  );

  return { bindTournament, openTimerForTournament, openTimerForStructure };
}
