import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Tournament } from '../types/tournament';
import { MOCK_TOURNAMENTS } from '../data/tournaments';
import { useProfile } from './ProfileContext';
import { CURRENT_USER_RATING } from '../types/player';

/** Reserved id for the logged-in player inside a tournament's participant list. */
export const CURRENT_USER_ID = 'me';

interface TournamentContextValue {
  tournaments: Tournament[];
  registrations: Set<string>;
  toggleRegistration: (tournamentId: string) => void;
  isRegistered: (tournamentId: string) => boolean;
  updateTournament: (tournamentId: string, patch: Partial<Tournament>) => void;
  addTournament: (tournament: Omit<Tournament, 'id'>) => string;
  deleteTournament: (tournamentId: string) => void;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const { nickname } = useProfile();
  const [tournaments, setTournaments] = useState<Tournament[]>(MOCK_TOURNAMENTS);
  const [registrations, setRegistrations] = useState<Set<string>>(new Set());

  const toggleRegistration = useCallback(
    (tournamentId: string) => {
      const wasRegistered = registrations.has(tournamentId);

      setRegistrations((prev) => {
        const next = new Set(prev);
        if (wasRegistered) next.delete(tournamentId);
        else next.add(tournamentId);
        return next;
      });

      // Occupied seats live in the participant list, so registering means joining it.
      setTournaments((ts) =>
        ts.map((t) => {
          if (t.id !== tournamentId) return t;

          if (wasRegistered) {
            return { ...t, participants: t.participants.filter((p) => p.id !== CURRENT_USER_ID) };
          }

          if (t.participants.some((p) => p.id === CURRENT_USER_ID)) return t;
          if (t.participants.length >= t.totalSeats) return t;

          return {
            ...t,
            participants: [
              ...t.participants,
              { id: CURRENT_USER_ID, nickname, rating: CURRENT_USER_RATING.points },
            ],
          };
        }),
      );
    },
    [registrations, nickname],
  );

  const isRegistered = useCallback(
    (tournamentId: string) => registrations.has(tournamentId),
    [registrations],
  );

  const updateTournament = useCallback((tournamentId: string, patch: Partial<Tournament>) => {
    setTournaments((ts) =>
      ts.map((t) => (t.id === tournamentId ? { ...t, ...patch } : t))
    );
  }, []);

  const addTournament = useCallback((tournament: Omit<Tournament, 'id'>) => {
    const id = `t-${Date.now()}`;
    setTournaments((ts) => [...ts, { ...tournament, id }]);
    return id;
  }, []);

  const deleteTournament = useCallback((tournamentId: string) => {
    setTournaments((ts) => ts.filter((t) => t.id !== tournamentId));
    setRegistrations((prev) => {
      if (!prev.has(tournamentId)) return prev;
      const next = new Set(prev);
      next.delete(tournamentId);
      return next;
    });
  }, []);

  return (
    <TournamentContext.Provider
      value={{
        tournaments,
        registrations,
        toggleRegistration,
        isRegistered,
        updateTournament,
        addTournament,
        deleteTournament,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournaments() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournaments must be used within TournamentProvider');
  return ctx;
}
