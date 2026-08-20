import type { Participant } from '../types/tournament';

/** Ruby payout from finishing place and field size. */
export function calculateRubies(place: number, totalPlayers: number): number {
  const field = Math.max(0, Math.trunc(Number(totalPlayers) || 0));
  const pos = Math.trunc(Number(place) || 0);
  if (pos < 1) return 0;
  if (pos === 1) return 1000 + field * 20;
  if (pos === 2) return 700 + field * 15;
  if (pos === 3) return 500 + field * 10;
  if (pos <= 9) return 300 + field * 5;
  return 150 + field * 2;
}

/** Stamp each participant with a one-shot ruby award from their finishing place. */
export function attachRubiesAwarded(participants: Participant[]): Participant[] {
  const totalPlayers = participants.length;
  return participants.map((participant) => ({
    ...participant,
    rubiesAwarded:
      typeof participant.place === 'number'
        ? calculateRubies(participant.place, totalPlayers)
        : 0,
  }));
}
