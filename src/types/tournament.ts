export interface Participant {
  id: string;
  /** Real `users.id` when the seat is bound to a club account; null for guests. */
  userId?: string | null;
  nickname: string;
  rating: number;
  /** Finishing place (1 = winner). Set when tournament results are entered. */
  place?: number;
  /** Knockouts scored in a bounty event; awarded as extra rating on close. */
  knockouts?: number;
  /** Rubies granted once when the tournament is closed. */
  rubiesAwarded?: number;
  /** Admin note from tournament cashier, shown in a closed lobby. */
  comment?: string;
  /**
   * True once an admin ticks «пришёл» in the lobby.
   * Missing on old rows — treated as already arrived so the cashier stays filled.
   */
  arrived?: boolean;
  /** Head-shot from the joined `users.equipped_avatar` column. */
  equippedAvatar?: string;
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

/** Global field size for every tournament (list, lobby, mocks, create form). */
export const DEFAULT_TOTAL_SEATS = 27;

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
  /** Optional finishing table; statistic finalists also read `participants.place`. */
  results?: Participant[];
  lateRegUntil: string;
  /** Catalog name of the blind ladder (display / fallback lookup). */
  blindStructure: string;
  /** Catalog id of the blind ladder. The Poker Timer binds through this, not the event title. */
  blindStructureId?: string;
  stackSize: number;
  levelDuration: string;
  /** Past / finished only when an admin has closed the tournament. */
  isClosed: boolean;
  /** Knockout / bounty format: extra rating for knockouts on close. */
  isBounty?: boolean;
  /** True after finishing places / rating awards have been submitted. */
  resultsEntered?: boolean;
  /** True after ruby payouts were written to player balances (once per event). */
  rubiesDistributed?: boolean;
  /** Admin-only note filled when closing the tournament. */
  adminSecretComment?: string;
  /** Dealers / admin hours logged at close. */
  staff?: TournamentStaffMember[];
  /** Dealers who worked the event (shown in a closed lobby). */
  dealers?: TournamentDealer[];
}
