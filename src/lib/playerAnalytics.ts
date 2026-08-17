import { itmPlaceCount, knockoutBountyPoints, ratingPointsForPlace } from '../data/prizeStructure';
import { formatTxDate } from './transactionDisplay';
import type { Transaction } from '../types/finance';
import type { Tournament } from '../types/tournament';

export type PlayerLedgerRow = {
  id: string;
  date: string;
  tournament: string;
  value: string;
};

export type PlayerTournamentRow = {
  id: string;
  title: string;
  place: number | null;
  field: number;
  itm: number;
};

export type PlayerAdminStats = {
  ltv: number;
  clubDebt: number;
  tournamentsPlayed: number;
  itmCount: number;
  winrate: number;
  dealerHours: number;
  favoriteTournament: string;
  favoriteTournamentCount: number;
  prizePoints: number;
  ltvRows: PlayerLedgerRow[];
  debtRows: PlayerLedgerRow[];
  dealerRows: PlayerLedgerRow[];
  visitRows: PlayerLedgerRow[];
  tournamentHistory: PlayerTournamentRow[];
};

export function hasGlobalUnpaidDebt(transactions: Transaction[], userId: string): boolean {
  return transactions.some((tx) => tx.userId === userId && tx.status === 'unpaid');
}

function tournamentTitle(tournaments: Tournament[], id: string): string {
  return tournaments.find((tournament) => tournament.id === id)?.title ?? id;
}

function formatMoney(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} ₽`;
}

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  const label = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace('.', ',');
  return `${label} ч`;
}

export function computePlayerAdminStats(
  playerId: string,
  nickname: string,
  tournaments: Tournament[],
  transactions: Transaction[],
  getDealerHours: (tournamentId: string, userId: string) => number,
): PlayerAdminStats {
  const mine = transactions.filter((tx) => tx.userId === playerId);
  const paid = mine.filter((tx) => tx.status === 'paid');
  const unpaid = mine.filter((tx) => tx.status === 'unpaid');
  const ltv = paid.reduce((sum, tx) => sum + tx.amount, 0);
  const clubDebt = unpaid.reduce((sum, tx) => sum + tx.amount, 0);

  const played = tournaments.filter((tournament) =>
    tournament.participants.some((participant) => participant.id === playerId),
  );

  const tournamentHistory: PlayerTournamentRow[] = played.map((tournament) => {
    const participant = tournament.participants.find((row) => row.id === playerId);
    const field = tournament.participants.length;
    return {
      id: tournament.id,
      title: tournament.title,
      place: typeof participant?.place === 'number' ? participant.place : null,
      field,
      itm: itmPlaceCount(field),
    };
  });

  const itmCount = tournamentHistory.filter(
    (row) => row.place != null && row.itm > 0 && row.place <= row.itm,
  ).length;
  const winrate = played.length === 0 ? 0 : (itmCount / played.length) * 100;

  let dealerHours = 0;
  const dealerRows: PlayerLedgerRow[] = [];
  for (const tournament of tournaments) {
    let hours = getDealerHours(tournament.id, playerId);
    if (hours <= 0 && !tournament.participants.some((row) => row.id === playerId)) {
      for (const dealer of tournament.dealers ?? []) {
        if (dealer.name === nickname) {
          hours += dealer.hours + dealer.minutes / 60;
        }
      }
    }
    if (hours <= 0) continue;
    dealerHours += hours;
    dealerRows.push({
      id: `dealer-${tournament.id}`,
      date: formatTxDate(`${tournament.startDate}T12:00:00`),
      tournament: tournament.title,
      value: formatHours(hours),
    });
  }

  const titleCounts = new Map<string, number>();
  for (const tournament of played) {
    titleCounts.set(tournament.title, (titleCounts.get(tournament.title) ?? 0) + 1);
  }
  let favoriteTournament = '—';
  let favoriteTournamentCount = 0;
  for (const [title, count] of titleCounts) {
    if (count > favoriteTournamentCount) {
      favoriteTournamentCount = count;
      favoriteTournament = title;
    }
  }

  let prizePoints = 0;
  for (const tournament of played) {
    const participant = tournament.participants.find((row) => row.id === playerId);
    if (!participant) continue;
    const field = tournament.participants.length;
    if (typeof participant.place === 'number') {
      prizePoints += ratingPointsForPlace(participant.place, tournament.guarantee, field);
    }
    prizePoints += knockoutBountyPoints(participant.knockouts, tournament.isBounty === true);
  }

  const toLedger = (tx: Transaction): PlayerLedgerRow => ({
    id: tx.id,
    date: formatTxDate(tx.date),
    tournament: tournamentTitle(tournaments, tx.tournamentId),
    value: formatMoney(tx.amount),
  });

  return {
    ltv,
    clubDebt,
    tournamentsPlayed: played.length,
    itmCount,
    winrate,
    dealerHours,
    favoriteTournament,
    favoriteTournamentCount,
    prizePoints,
    ltvRows: paid.map(toLedger),
    debtRows: unpaid.map(toLedger),
    dealerRows,
    visitRows: played.map((tournament) => ({
      id: `visit-${tournament.id}`,
      date: formatTxDate(`${tournament.startDate}T12:00:00`),
      tournament: tournament.title,
      value: '1 визит',
    })),
    tournamentHistory,
  };
}
