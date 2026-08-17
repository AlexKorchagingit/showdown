import { itmPlaceCount } from '../data/prizeStructure';
import type { Transaction } from '../types/finance';
import type { Tournament } from '../types/tournament';

export type PlayerAdminStats = {
  ltv: number;
  clubDebt: number;
  tournamentsPlayed: number;
  itmCount: number;
  winrate: number;
  dealerHours: number;
  favoriteTournament: string;
};

export function hasGlobalUnpaidDebt(transactions: Transaction[], userId: string): boolean {
  return transactions.some((tx) => tx.userId === userId && tx.status === 'unpaid');
}

export function computePlayerAdminStats(
  playerId: string,
  nickname: string,
  tournaments: Tournament[],
  transactions: Transaction[],
  getDealerHours: (tournamentId: string, userId: string) => number,
): PlayerAdminStats {
  const mine = transactions.filter((tx) => tx.userId === playerId);
  const ltv = mine
    .filter((tx) => tx.status === 'paid')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const clubDebt = mine
    .filter((tx) => tx.status === 'unpaid')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const played = tournaments.filter((tournament) =>
    tournament.participants.some((participant) => participant.id === playerId),
  );

  const itmCount = played.filter((tournament) => {
    const participant = tournament.participants.find((row) => row.id === playerId);
    if (typeof participant?.place !== 'number') return false;
    const paidPlaces = itmPlaceCount(tournament.participants.length);
    return paidPlaces > 0 && participant.place <= paidPlaces;
  }).length;

  const winrate = played.length === 0 ? 0 : (itmCount / played.length) * 100;

  let dealerHours = 0;
  for (const tournament of tournaments) {
    const logged = getDealerHours(tournament.id, playerId);
    dealerHours += logged;
    if (logged > 0) continue;
    if (tournament.participants.some((row) => row.id === playerId)) continue;
    for (const dealer of tournament.dealers ?? []) {
      if (dealer.name === nickname) {
        dealerHours += dealer.hours + dealer.minutes / 60;
      }
    }
  }

  const titleCounts = new Map<string, number>();
  for (const tournament of played) {
    titleCounts.set(tournament.title, (titleCounts.get(tournament.title) ?? 0) + 1);
  }
  let favoriteTournament = '—';
  let best = 0;
  for (const [title, count] of titleCounts) {
    if (count > best) {
      best = count;
      favoriteTournament = title;
    }
  }

  return {
    ltv,
    clubDebt,
    tournamentsPlayed: played.length,
    itmCount,
    winrate,
    dealerHours,
    favoriteTournament,
  };
}
