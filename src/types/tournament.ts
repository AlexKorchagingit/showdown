export type TournamentStatus = 'upcoming' | 'active' | 'finished';

export interface Tournament {
  id: string;
  title: string;
  imageUrl: string;
  startDate: string;
  startTime: string;
  totalSeats: number;
  registeredSeats: number;
  buyIn: number;
  guarantee: number;
  status: TournamentStatus;
  description: string;
  features: string[];
  lateRegUntil: string;
  blindStructure: string;
  stackSize: number;
  levelDuration: string;
}

export interface TournamentRegistration {
  tournamentId: string;
  isRegistered: boolean;
}
