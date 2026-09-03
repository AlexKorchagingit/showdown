import { itmPlaceCount, knockoutBountyPoints, ratingPointsForPlace } from '../data/prizeStructure';
import { calculateRubies, isBountyEvent } from './calculateRubies';
import { guestSeatKey } from './guestPlayer';
import { sanitizeParticipantUserId } from './supabaseMap';
import { formatTxDate } from './transactionDisplay';
import type { Transaction } from '../types/finance';
import type { Participant, Tournament } from '../types/tournament';

export type PlayerLedgerRow = {
  id: string;
  date: string;
  tournament: string;
  value: string;
};

export type PlayerTournamentRow = {
  id: string;
  title: string;
  date: string;
  place: number | null;
  field: number;
  itm: number;
};

export type PlayerGameHistoryRow = {
  id: string;
  date: string;
  title: string;
  field: number;
  place: number | null;
  knockouts: number;
  ratingAwarded: number;
  rubiesAwarded: number;
  startDate: string;
};

function participantMatches(
  participant: Participant,
  userIds: Set<string>,
): boolean {
  const boundId = sanitizeParticipantUserId(participant.userId ?? '');
  if (boundId && userIds.has(boundId)) return true;
  const seatId = guestSeatKey(participant.id);
  return Boolean(seatId) && userIds.has(seatId);
}

function findPlayerInTournament(
  tournament: Tournament,
  userIds: Set<string>,
): Participant | undefined {
  const rows = [...tournament.participants, ...(tournament.results ?? [])];
  return rows.find((row) => participantMatches(row, userIds));
}

/** Closed events this player finished, bound by `participants.user_id` (not nickname). */
export function collectPlayerGameHistory(
  tournaments: Tournament[],
  userIds: string[],
  _nickname?: string,
): PlayerGameHistoryRow[] {
  const ids = new Set(userIds.map((id) => id.trim()).filter(Boolean));
  const rows: PlayerGameHistoryRow[] = [];

  for (const tournament of tournaments) {
    if (!tournament.isClosed) continue;
    const participant = findPlayerInTournament(tournament, ids);
    if (!participant) continue;

    const field = Math.max(tournament.participants.length, tournament.results?.length ?? 0);
    const place = typeof participant.place === 'number' ? participant.place : null;
    const knockouts = Math.max(0, Math.floor(Number(participant.knockouts) || 0));
    const ratingAwarded =
      (place != null ? ratingPointsForPlace(place, tournament.guarantee, field) : 0) +
      knockoutBountyPoints(knockouts, tournament.isBounty === true);
    const storedRubies =
      typeof participant.rubiesAwarded === 'number' ? Math.max(0, Math.floor(participant.rubiesAwarded)) : null;
    const rubiesAwarded =
      storedRubies != null
        ? storedRubies
        : place != null
          ? calculateRubies(place, field, knockouts, isBountyEvent(tournament))
          : 0;
    const dateLabel = tournament.startTime
      ? `${formatTxDate(`${tournament.startDate}T12:00:00`)} · ${tournament.startTime}`
      : formatTxDate(`${tournament.startDate}T12:00:00`);

    rows.push({
      id: tournament.id,
      date: dateLabel,
      title: tournament.title,
      field,
      place,
      knockouts,
      ratingAwarded,
      rubiesAwarded,
      startDate: tournament.startDate,
    });
  }

  return rows.sort((a, b) => b.startDate.localeCompare(a.startDate) || b.title.localeCompare(a.title, 'ru'));
}

export type PlayerProfileStats = {
  games: number;
  wins: number;
  finals: number;
  knockouts: number;
  headsUp: number;
  top3: number;
};

/** Same closed-event rows as the game-history sheet, rolled up for the profile column. */
export function summarizePlayerGameHistory(history: PlayerGameHistoryRow[]): PlayerProfileStats {
  let wins = 0;
  let finals = 0;
  let knockouts = 0;
  let headsUp = 0;
  let top3 = 0;
  for (const row of history) {
    knockouts += row.knockouts;
    const place = row.place;
    if (place == null) continue;
    if (place === 1) wins += 1;
    if (place <= 2) headsUp += 1;
    if (place <= 3) top3 += 1;
    if (place <= 9) finals += 1;
  }
  return {
    games: history.length,
    wins,
    finals,
    knockouts,
    headsUp,
    top3,
  };
}

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
  avgRebuys: number;
  addonRate: number;
  rebuyCount: number;
  addonCount: number;
  addonEligibleTournaments: number;
  ltvRows: PlayerLedgerRow[];
  debtRows: PlayerLedgerRow[];
  dealerRows: PlayerLedgerRow[];
  visitRows: PlayerLedgerRow[];
  prizeRows: PlayerLedgerRow[];
  rebuyRows: PlayerLedgerRow[];
  addonRows: PlayerLedgerRow[];
  tournamentHistory: PlayerTournamentRow[];
};

export function tournamentOffersAddon(tournament: Tournament): boolean {
  return (tournament.features ?? []).some((feature) => {
    const value = feature.toLowerCase();
    return value.includes('аддон') || value.includes('addon');
  });
}

export function formatAvgRebuys(avg: number, tournamentsPlayed: number): string {
  if (tournamentsPlayed <= 0) return '0';
  return avg.toFixed(1);
}

export function formatAddonRate(percent: number): string {
  return `${Math.round(percent)}%`;
}

export function hasGlobalUnpaidDebt(transactions: Transaction[], userId: string): boolean {
  return transactions.some((tx) => !tx.voidedAt && tx.userId === userId && tx.status === 'unpaid');
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
  const mine = transactions.filter((tx) => !tx.voidedAt && tx.userId === playerId);
  const paid = mine.filter((tx) => tx.status === 'paid');
  const unpaid = mine.filter((tx) => tx.status === 'unpaid');
  const ltv = paid.reduce((sum, tx) => sum + tx.amount, 0);
  const clubDebt = unpaid.reduce((sum, tx) => sum + tx.amount, 0);
  const rebuys = mine.filter((tx) => tx.type === 'rebuy');
  const addons = mine.filter((tx) => tx.type === 'addon');

  const ids = new Set([playerId].filter(Boolean));
  const played = tournaments.filter((tournament) =>
    tournament.participants.some((participant) => participantMatches(participant, ids)),
  );
  const addonEligible = played.filter(tournamentOffersAddon);
  const addonDenom = addonEligible.length > 0 ? addonEligible.length : played.length;
  const avgRebuys = played.length === 0 ? 0 : rebuys.length / played.length;
  const addonRate = addonDenom === 0 ? 0 : (addons.length / addonDenom) * 100;

  const tournamentHistory: PlayerTournamentRow[] = played.map((tournament) => {
    const participant = tournament.participants.find((row) =>
      participantMatches(row, ids),
    );
    const field = tournament.participants.length;
    return {
      id: tournament.id,
      title: tournament.title,
      date: formatTxDate(`${tournament.startDate}T12:00:00`),
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
    if (hours <= 0 && !tournament.participants.some((row) => participantMatches(row, ids))) {
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
  const prizeRows: PlayerLedgerRow[] = [];
  for (const tournament of played) {
    const participant = tournament.participants.find((row) =>
      participantMatches(row, ids),
    );
    if (!participant) continue;
    const field = tournament.participants.length;
    let points = 0;
    if (typeof participant.place === 'number') {
      points += ratingPointsForPlace(participant.place, tournament.guarantee, field);
    }
    points += knockoutBountyPoints(participant.knockouts, tournament.isBounty === true);
    prizePoints += points;
    prizeRows.push({
      id: `prize-${tournament.id}`,
      date: formatTxDate(`${tournament.startDate}T12:00:00`),
      tournament: tournament.title,
      value: points.toLocaleString('ru-RU'),
    });
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
      value: '',
    })),
    prizeRows,
    rebuyRows: rebuys.map(toLedger),
    addonRows: addons.map(toLedger),
    tournamentHistory,
    avgRebuys,
    addonRate,
    rebuyCount: rebuys.length,
    addonCount: addons.length,
    addonEligibleTournaments: addonDenom,
  };
}
