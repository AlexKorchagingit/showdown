export interface Participant {
  id: string;
  nickname: string;
  rating: number;
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
}
