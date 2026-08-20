import type { Participant, Tournament } from '../types/tournament';

function placeBase(place: number, totalPlayers: number): number {
  const field = Math.max(0, Math.trunc(Number(totalPlayers) || 0));
  const pos = Math.trunc(Number(place) || 0);
  if (pos < 1) return 0;
  if (pos === 1) return 1000 + field * 20;
  if (pos === 2) return 700 + field * 15;
  if (pos === 3) return 500 + field * 10;
  if (pos <= 9) return 300 + field * 5;
  return 150 + field * 2;
}

/**
 * Ruby payout from finishing place, field size, and (for bounty events) knockouts.
 * Regular events pay the place base. Bounty events pay 75% of that base plus 100 per knockout.
 */
export function calculateRubies(
  place: number,
  totalPlayers: number,
  knockouts = 0,
  isBounty = false,
): number {
  const base = placeBase(place, totalPlayers);
  if (!isBounty) return base;
  const knockoutBonus = Math.max(0, Math.trunc(Number(knockouts) || 0)) * 100;
  return Math.round(base * 0.75) + knockoutBonus;
}

/** Bounty flag, or the word "Bounty" in the title / assigned structure name. */
export function isBountyEvent(
  tournament: Pick<Tournament, 'isBounty' | 'title' | 'blindStructure'>,
): boolean {
  if (tournament.isBounty === true) return true;
  return /bounty/i.test(`${tournament.title} ${tournament.blindStructure ?? ''}`);
}

/** Stamp each participant with a one-shot ruby award from their finishing place. */
export function attachRubiesAwarded(
  participants: Participant[],
  isBounty = false,
): Participant[] {
  const totalPlayers = participants.length;
  return participants.map((participant) => ({
    ...participant,
    rubiesAwarded:
      typeof participant.place === 'number'
        ? calculateRubies(
            participant.place,
            totalPlayers,
            participant.knockouts ?? 0,
            isBounty,
          )
        : 0,
  }));
}
