import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Tournament } from '../types/tournament';
import { MOCK_TOURNAMENTS } from '../data/tournaments';

interface TournamentContextValue {
  tournaments: Tournament[];
  registrations: Set<string>;
  toggleRegistration: (tournamentId: string) => void;
  isRegistered: (tournamentId: string) => boolean;
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

  return (
    <TournamentContext.Provider value={{ tournaments, registrations, toggleRegistration, isRegistered }}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournaments() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournaments must be used within TournamentProvider');
  return ctx;
}
