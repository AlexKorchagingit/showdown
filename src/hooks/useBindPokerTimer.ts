import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlinds } from '../context/BlindsContext';
import { useTournaments } from '../context/TournamentContext';
import {
  resolveStructureForTournament,
  resolveTournamentForTimer,
  timerPathForStructure,
  timerPathForTournament,
} from '../lib/timerTournament';

/** Bind the blinds timer to a TournamentContext row. */
export function useBindPokerTimer() {
  const navigate = useNavigate();
  const { tournaments } = useTournaments();
  const {
    timerReady,
    structures,
    ensureTimer,
    setLinkedTournament,
    linkedTournamentId,
    activeStructureId,
  } = useBlinds();

  const bindTournament = useCallback(
    (tournamentId: string | null) => {
      if (!timerReady) return;
      const switching = tournamentId !== linkedTournamentId;
      if (switching) setLinkedTournament(tournamentId);
      if (!tournamentId) return;

      const tournament = tournaments.find((row) => row.id === tournamentId);
      if (!tournament) return;

      const structure = resolveStructureForTournament(tournament, structures);
      if (structure && structure.id !== activeStructureId) ensureTimer(structure.id);
    },
    [
      tournaments,
      structures,
      ensureTimer,
      setLinkedTournament,
      linkedTournamentId,
      activeStructureId,
      timerReady,
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
      const resolved = resolveTournamentForTimer(structure, tournaments, linkedTournamentId);
      if (resolved) {
        openTimerForTournament(resolved.id);
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
