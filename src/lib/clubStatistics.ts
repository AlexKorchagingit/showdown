import { isComplimentaryCharge } from './entryFee';
import { clubUserIdSet, isRegisteredClubSeat } from './clubRating';
import { tournamentOffersAddon } from './playerAnalytics';
import {
  buildAttendanceChart,
  type AttendanceChartRow,
  type AttendanceSeed,
  type StatsPeriod,
} from './statsPeriod';
import { cashierPlayers, scoringFieldSize } from './tournamentArrival';
import { guestSeatKey, isUnboundGuestSeat } from './guestPlayer';
import { displayedTeamPlace } from './teamBattle';
import { finalTableSize } from '../data/prizeStructure';
import type { Transaction } from '../types/finance';
import type { Participant, Tournament } from '../types/tournament';

export type { StatsPeriod };
export {
  filterStatisticTournaments,
  tournamentInPeriod,
} from './statsPeriod';

export type ClubLeader = {
  id: string;
  nickname: string;
  value: number;
};

export type ClubStatistics = {
  averageAttendance: number;
  popularTournament: string;
  averageCheck: number;
  debtorPercent: number;
  biggestCheck: { amount: number; nickname: string; tournament: string };
  attendanceChart: AttendanceChartRow[];
  topAttendance: ClubLeader[];
  topFinalists: ClubLeader[];
  topBounty: ClubLeader[];
  tournamentCount: number;
  avgRebuys: number;
  addonRate: number;
  rebuyCount: number;
  addonCount: number;
  seatedCount: number;
  addonEligibleSeats: number;
  /** Checked-in seats that are not counted: nick-only players and archived accounts. */
  skippedSeats: number;
  /** Distinct nick-only players behind those seats. */
  unboundNicks: number;
};

export type ClubLeaders = {
  attendance: ClubLeader[];
  finalists: ClubLeader[];
  bounty: ClubLeader[];
};

const EMPTY_STATS: ClubStatistics = {
  averageAttendance: 0,
  popularTournament: '—',
  averageCheck: 0,
  debtorPercent: 0,
  biggestCheck: { amount: 0, nickname: '—', tournament: '—' },
  attendanceChart: [],
  topAttendance: [],
  topFinalists: [],
  topBounty: [],
  tournamentCount: 0,
  avgRebuys: 0,
  addonRate: 0,
  rebuyCount: 0,
  addonCount: 0,
  seatedCount: 0,
  addonEligibleSeats: 0,
  skippedSeats: 0,
  unboundNicks: 0,
};

export function tournamentTitles(tournaments: Tournament[]): string[] {
  return [...new Set(tournaments.filter((tournament) => tournament.hidden !== true).map((tournament) => tournament.title))];
}

function topThree(
  map: Map<string, { nickname: string; value: number }>,
  ratingById?: Map<string, number>,
): ClubLeader[] {
  return [...map.entries()]
    .map(([id, row]) => ({ id, nickname: row.nickname, value: row.value }))
    .filter((row) => row.value > 0)
    .sort(
      (a, b) =>
        b.value - a.value ||
        (ratingById?.get(b.id) ?? 0) - (ratingById?.get(a.id) ?? 0) ||
        a.nickname.localeCompare(b.nickname, 'ru'),
    )
    .slice(0, 3);
}

/** A tournament that actually took place: somebody is checked in or already has a finishing place. */
export function tournamentWasPlayed(tournament: Pick<Tournament, 'participants'>): boolean {
  return cashierPlayers(tournament.participants).length > 0;
}

/** Accepts numeric places and string leftovers from older saved results. */
export function parseFinishingPlace(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(parsed)) return null;
    return Math.trunc(parsed);
  }
  return null;
}

function clubCashierSeats(
  tournament: Pick<Tournament, 'participants'>,
  knownIds: Set<string>,
): Participant[] {
  return cashierPlayers(tournament.participants).filter((player) =>
    isRegisteredClubSeat(player, knownIds),
  );
}

function clubSeatId(participant: Participant, knownIds: Set<string>): string | null {
  if (!isRegisteredClubSeat(participant, knownIds)) return null;
  return String(participant.userId ?? participant.id ?? '').trim() || null;
}

function bumpLeader(
  map: Map<string, { nickname: string; value: number }>,
  playerId: string,
  nickname: string,
  delta = 1,
): void {
  if (!playerId) return;
  const row = map.get(playerId) ?? { nickname: nickname || playerId, value: 0 };
  row.value += delta;
  if (nickname) row.nickname = nickname;
  map.set(playerId, row);
}

function nicknameFor(
  userId: string,
  fallback: string,
  names: Map<string, string>,
): string {
  return names.get(userId) || fallback || userId;
}

/** Final-table finishes from the already filtered tournament list, grouped by club user id. */
export function collectTopFinalists(
  tournaments: Tournament[],
  knownIds: Set<string>,
  names: Map<string, string>,
  ratingById?: Map<string, number>,
): ClubLeader[] {
  const finalists = new Map<string, { nickname: string; value: number }>();

  for (const tournament of tournaments) {
    const field = scoringFieldSize(tournament);
    const table = finalTableSize(field);
    if (table <= 0) continue;
    const rows = [...tournament.participants, ...(tournament.results ?? [])];
    const counted = new Set<string>();

    for (const participant of rows) {
      const place =
        displayedTeamPlace(participant, tournament) ?? parseFinishingPlace(participant.place);
      if (place == null || place < 1 || place > table) continue;
      const userId = clubSeatId(participant, knownIds);
      if (!userId || counted.has(userId)) continue;
      counted.add(userId);
      bumpLeader(finalists, userId, nicknameFor(userId, participant.nickname, names));
    }
  }

  return topThree(finalists, ratingById);
}

/** Top-3 lists by attendance, final tables and knockouts. Tournaments that did not take place are ignored. */
export function computeClubLeaders(
  tournaments: Tournament[],
  clubUsers: { id: string; nickname: string }[],
  ratingById?: Map<string, number>,
): ClubLeaders {
  const knownIds = clubUserIdSet(clubUsers);
  const names = new Map(clubUsers.map((user) => [user.id, user.nickname]));
  const played = tournaments.filter(tournamentWasPlayed);
  const attendance = new Map<string, { nickname: string; value: number }>();
  const bounty = new Map<string, { nickname: string; value: number }>();

  for (const tournament of played) {
    for (const participant of clubCashierSeats(tournament, knownIds)) {
      const userId = clubSeatId(participant, knownIds);
      if (!userId) continue;
      const nick = nicknameFor(userId, participant.nickname, names);
      bumpLeader(attendance, userId, nick);
      const knockouts = participant.knockouts ?? 0;
      if (knockouts > 0) bumpLeader(bounty, userId, nick, knockouts);
    }
  }

  return {
    attendance: topThree(attendance, ratingById),
    finalists: collectTopFinalists(played, knownIds, names, ratingById),
    bounty: topThree(bounty, ratingById),
  };
}

export function computeClubStatistics(
  tournaments: Tournament[],
  transactions: Transaction[],
  clubUsers: { id: string; nickname: string }[],
  period: StatsPeriod = 'all',
  now = new Date(),
): ClubStatistics {
  const knownIds = clubUserIdSet(clubUsers);
  const names = new Map(clubUsers.map((user) => [user.id, user.nickname]));
  // An upcoming or not-yet-started event has nobody checked in. Counting it would drag every average down.
  const played = tournaments.filter(tournamentWasPlayed);

  if (played.length === 0) {
    return {
      ...EMPTY_STATS,
      attendanceChart: buildAttendanceChart([], period, now),
    };
  }
  const tournamentIds = new Set(played.map((tournament) => tournament.id));
  const titleById = new Map(played.map((tournament) => [tournament.id, tournament.title]));
  const ledger = transactions.filter(
    (tx) => !tx.voidedAt && tournamentIds.has(tx.tournamentId) && knownIds.has(tx.userId),
  );

  const seatedByTournament = played.map((tournament) => clubCashierSeats(tournament, knownIds));
  const seatedCount = seatedByTournament.reduce((sum, seats) => sum + seats.length, 0);
  const averageAttendance = seatedCount / played.length;

  let skippedSeats = 0;
  const unboundKeys = new Set<string>();
  played.forEach((tournament, index) => {
    const checkedIn = cashierPlayers(tournament.participants);
    skippedSeats += checkedIn.length - seatedByTournament[index]!.length;
    for (const player of checkedIn) {
      if (isUnboundGuestSeat(player)) unboundKeys.add(guestSeatKey(player.id, tournament.id));
    }
  });

  const titleCounts = new Map<string, number>();
  played.forEach((tournament, index) => {
    titleCounts.set(
      tournament.title,
      (titleCounts.get(tournament.title) ?? 0) + seatedByTournament[index]!.length,
    );
  });
  let popularTournament = '—';
  let popularCount = 0;
  for (const [title, count] of titleCounts) {
    if (count > popularCount) {
      popularCount = count;
      popularTournament = title;
    }
  }

  const paidCharges = ledger.filter((tx) => tx.status === 'paid' && tx.amount > 0 && !isComplimentaryCharge(tx));
  const revenue = paidCharges.reduce((sum, tx) => sum + tx.amount, 0);
  const averageCheck = paidCharges.length > 0 ? revenue / paidCharges.length : 0;

  const unpaidSum = ledger
    .filter((tx) => tx.status === 'unpaid')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const allSum = ledger.reduce((sum, tx) => sum + tx.amount, 0);
  const debtorPercent = allSum > 0 ? (unpaidSum / allSum) * 100 : 0;

  const checkByPlayerEvent = new Map<string, { amount: number; userId: string; tournamentId: string }>();
  for (const tx of paidCharges) {
    const key = `${tx.userId}::${tx.tournamentId}`;
    const prev = checkByPlayerEvent.get(key);
    checkByPlayerEvent.set(key, {
      amount: (prev?.amount ?? 0) + tx.amount,
      userId: tx.userId,
      tournamentId: tx.tournamentId,
    });
  }
  let biggestCheck = { amount: 0, nickname: '—', tournament: '—' };
  for (const row of checkByPlayerEvent.values()) {
    if (row.amount > biggestCheck.amount) {
      biggestCheck = {
        amount: row.amount,
        nickname: names.get(row.userId) || row.userId,
        tournament: titleById.get(row.tournamentId) ?? row.tournamentId,
      };
    }
  }

  const leaders = computeClubLeaders(played, clubUsers);
  const attendanceRows: AttendanceSeed[] = played.map((tournament, index) => ({
    tournament,
    players: seatedByTournament[index]!.length,
  }));
  const attendanceChart = buildAttendanceChart(attendanceRows, period, now);

  const rebuyCount = ledger.filter((tx) => tx.type === 'rebuy').length;
  const addonCount = ledger.filter((tx) => tx.type === 'addon').length;
  const addonEligibleSeats = played.reduce((sum, tournament, index) => {
    if (!tournamentOffersAddon(tournament)) return sum;
    return sum + seatedByTournament[index]!.length;
  }, 0);
  const addonDenom = addonEligibleSeats > 0 ? addonEligibleSeats : seatedCount;
  const avgRebuys = seatedCount === 0 ? 0 : rebuyCount / seatedCount;
  const addonRate = addonDenom === 0 ? 0 : (addonCount / addonDenom) * 100;

  return {
    averageAttendance,
    popularTournament,
    averageCheck,
    debtorPercent,
    biggestCheck,
    attendanceChart,
    topAttendance: leaders.attendance,
    topFinalists: leaders.finalists,
    topBounty: leaders.bounty,
    tournamentCount: played.length,
    avgRebuys,
    addonRate,
    rebuyCount,
    addonCount,
    seatedCount,
    addonEligibleSeats,
    skippedSeats,
    unboundNicks: unboundKeys.size,
  };
}
