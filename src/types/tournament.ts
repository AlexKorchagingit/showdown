export interface Participant {
  id: string;
  nickname: string;
  rating: number;
  /** Finishing place (1 = winner). Set when tournament results are entered. */
  place?: number;
  /** Admin note from tournament cashier, shown in a closed lobby. */
  comment?: string;
}

export interface TournamentStaffMember {
  role: string;
  name: string;
  hours: number;
  minutes: number;
}

export interface TournamentDealer {
  name: string;
  hours: number;
  minutes: number;
  /** ISO timestamp of when this hours row was logged / last changed. */
  loggedAt?: string;
  /** Admin note for this dealer row. */
  comment?: string;
}

export const DEFAULT_STAFF_ROLES = ['Админ', 'Дилер 1', 'Дилер 2', 'Дилер 3'] as const;

export function createEmptyStaff(): TournamentStaffMember[] {
  return DEFAULT_STAFF_ROLES.map((role) => ({
    role,
    name: '',
    hours: 0,
    minutes: 0,
  }));
}

export interface Tournament {
  id: string;
  title: string;
  imageUrl: string;
  address: string;
  startDate: string;
  startTime: string;
  totalSeats: number;
  guarantee: number;
  about: string;
  features: string[];
  /** Occupied seats are always derived from this list — never stored separately. */
  participants: Participant[];
  lateRegUntil: string;
  blindStructure: string;
  stackSize: number;
  levelDuration: string;
  /** Past / finished only when an admin has closed the tournament. */
  isClosed: boolean;
  /** True after admin has submitted finishing places / rating awards. */
  resultsEntered?: boolean;
  /** Admin-only note filled when closing the tournament. */
  adminSecretComment?: string;
  /** Dealers / admin hours logged at close. */
  staff?: TournamentStaffMember[];
  /** Dealers who worked the event (shown in a closed lobby). */
  dealers?: TournamentDealer[];
}
