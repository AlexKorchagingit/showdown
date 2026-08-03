import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Tournament } from '../types/tournament';
import { MOCK_TOURNAMENTS } from '../data/tournaments';

interface TournamentContextValue {
  tournaments: Tournament[];
  registrations: Set<string>;
  toggleRegistration: (tournamentId: string) => void;
  isRegistered: (tournamentId: string) => boolean;
  updateTournament: (tournamentId: string, patch: Partial<Tournament>) => void;
  addTournament: (tournament: Omit<Tournament, 'id'>) => string;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const [tournaments, setTournaments] = useState<Tournament[]>(MOCK_TOURNAMENTS);
  const [registrations, setRegistrations] = useState<Set<string>>(new Set());

  const toggleRegistration = useCallback((tournamentId: string) => {
    setRegistrations((prev) => {
      const next = new Set(prev);
      const wasRegistered = next.has(tournamentId);

      if (wasRegistered) {
        next.delete(tournamentId);
      } else {
        next.add(tournamentId);
      }

      setTournaments((ts) =>
        ts.map((t) =>
          t.id === tournamentId
            ? {
                ...t,
                registeredSeats: wasRegistered
                  ? Math.max(0, t.registeredSeats - 1)
                  : Math.min(t.totalSeats, t.registeredSeats + 1),
              }
            : t
        )
      );

      return next;
    });
  }, []);

  const isRegistered = useCallback(
    (tournamentId: string) => registrations.has(tournamentId),
    [registrations]
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

  return (
    <TournamentContext.Provider
      value={{
        tournaments,
        registrations,
        toggleRegistration,
        isRegistered,
        updateTournament,
        addTournament,
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
