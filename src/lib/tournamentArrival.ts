import type { Participant, Tournament } from '../types/tournament';

/**
 * Checked-in for the cashier. Missing `arrived` (old rows) counts as present
 * so existing events do not empty the cashier on deploy.
 */
export function isArrivedPlayer(player: Pick<Participant, 'arrived'>): boolean {
  return player.arrived !== false;
}

/** Players who showed up — the cashier field and prize pool size. */
export function cashierPlayers(participants: Participant[]): Participant[] {
  return participants.filter((player) => isArrivedPlayer(player));
}

export function cashierFieldSize(tournament: Pick<Tournament, 'participants'>): number {
  return cashierPlayers(tournament.participants).length;
}

/** Bust-outs from the cashier (`place` set). Closed public lobby uses this list. */
export function finishedLobbyPlayers(participants: Participant[]): Participant[] {
  return participants.filter((player) => typeof player.place === 'number' && player.place >= 1);
}

export function hasArrivedWithoutPlace(participants: Participant[]): boolean {
  return cashierPlayers(participants).some((player) => typeof player.place !== 'number' || player.place < 1);
}
