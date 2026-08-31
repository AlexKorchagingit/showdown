import type { Participant, Tournament } from '../types/tournament';

/**
 * Checked-in for the cashier. Only an explicit green tick counts —
 * a missing flag is "signed up, not here yet".
 */
export function isArrivedPlayer(player: Pick<Participant, 'arrived'>): boolean {
  return player.arrived === true;
}

/** Players who showed up — the cashier field and prize pool size. */
export function cashierPlayers(participants: Participant[]): Participant[] {
  return participants.filter(
    (player) => isArrivedPlayer(player) || (typeof player.place === 'number' && player.place >= 1),
  );
}

/** Cashier seats that have not been given a finishing place yet. */
export function cashierStillPlaying(participants: Participant[]): Participant[] {
  return cashierPlayers(participants).filter(
    (player) => typeof player.place !== 'number' || player.place < 1,
  );
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
