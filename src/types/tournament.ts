export interface Participant {
  id: string;
  nickname: string;
  rating: number;
  /** Finishing place (1 = winner). Set when tournament results are entered. */
  place?: number;
}

export interface TournamentStaffMember {
  role: string;
  name: string;
  hours: number;
  minutes: number;
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
  /** True after admin has submitted finishing places / rating awards. */
  resultsEntered?: boolean;
  /** Admin-only note filled when closing the tournament. */
  adminSecretComment?: string;
  /** Dealers / admin hours logged at close. */
  staff?: TournamentStaffMember[];
}
