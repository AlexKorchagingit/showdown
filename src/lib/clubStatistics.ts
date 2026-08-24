import { startOfDay } from './financePeriod';
import { clubUserIdSet, isRegisteredClubSeat } from './clubRating';
import { tournamentOffersAddon } from './playerAnalytics';
import { compareByStart } from './tournamentStatus';
import type { Transaction } from '../types/finance';
import type { Participant, Tournament } from '../types/tournament';

export type StatsPeriod = 'week' | 'month' | 'all';

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
  attendanceChart: { id: string; label: string; title: string; players: number }[];
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
};

export function tournamentTitles(tournaments: Tournament[]): string[] {
  return [...new Set(tournaments.map((tournament) => tournament.title))];
}

export function tournamentInPeriod(
  startDate: string,
  period: StatsPeriod,
  now = new Date(),
): boolean {
  if (period === 'all') return true;
  const day = startOfDay(new Date(`${startDate}T12:00:00`));
  if (Number.isNaN(day.getTime())) return false;

  if (period === 'month') {
    return day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth();
  }

  const from = startOfDay(now);
  from.setDate(from.getDate() - 7);
  const to = startOfDay(now);
  to.setDate(to.getDate() + 7);
  return day.getTime() >= from.getTime() && day.getTime() <= to.getTime();
}

export function filterStatisticTournaments(
  tournaments: Tournament[],
  period: StatsPeriod,
  formatTitle: string,
): Tournament[] {
  const needle = formatTitle.trim().toLowerCase();
  return tournaments.filter((tournament) => {
    if (needle && needle !== 'all') {
      const title = tournament.title.trim().toLowerCase();
      const structure = tournament.blindStructure.trim().toLowerCase();
      if (title !== needle && structure !== needle) return false;
    }
    return tournamentInPeriod(tournament.startDate, period);
  });
}

function topThree(map: Map<string, { nickname: string; value: number }>): ClubLeader[] {
  return [...map.entries()]
    .map(([id, row]) => ({ id, nickname: row.nickname, value: row.value }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.nickname.localeCompare(b.nickname, 'ru'))
    .slice(0, 3);
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

/** Axis label: `24.08`, plus year when the event is not in the current calendar year. */
function formatAttendanceDate(startDate: string, now = new Date()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((startDate ?? '').trim());
  if (!match) return (startDate ?? '').trim() || '—';
  const year = Number(match[1]);
  const dayMonth = `${match[3]}.${match[2]}`;
  return year !== now.getFullYear() ? `${dayMonth}.${String(year).slice(-2)}` : dayMonth;
}

function formatAttendanceTime(startTime: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec((startTime ?? '').trim());
  if (!match) return '';
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
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

/** Top-9 finishes from the already filtered tournament list, grouped by club user id. */
export function collectTopFinalists(
  tournaments: Tournament[],
  knownIds: Set<string>,
  names: Map<string, string>,
): ClubLeader[] {
  const finalists = new Map<string, { nickname: string; value: number }>();

  for (const tournament of tournaments) {
    const rows = [...tournament.participants, ...(tournament.results ?? [])];
    const counted = new Set<string>();

    for (const participant of rows) {
      const place = parseFinishingPlace(participant.place);
      if (place == null || place < 1 || place > 9) continue;
      const userId = clubSeatId(participant, knownIds);
      if (!userId || counted.has(userId)) continue;
      counted.add(userId);
      bumpLeader(finalists, userId, nicknameFor(userId, participant.nickname, names));
    }
  }

  return topThree(finalists);
}

export function computeClubStatistics(
  tournaments: Tournament[],
  transactions: Transaction[],
  clubUsers: { id: string; nickname: string }[],
): ClubStatistics {
  if (tournaments.length === 0) return EMPTY_STATS;

  const knownIds = clubUserIdSet(clubUsers);
  const names = new Map(clubUsers.map((user) => [user.id, user.nickname]));
  const tournamentIds = new Set(tournaments.map((tournament) => tournament.id));
  const titleById = new Map(tournaments.map((tournament) => [tournament.id, tournament.title]));
  const ledger = transactions.filter(
    (tx) => tournamentIds.has(tx.tournamentId) && knownIds.has(tx.userId),
  );

  const seatedByTournament = tournaments.map((tournament) =>
    tournament.participants.filter((player) => isRegisteredClubSeat(player, knownIds)),
  );
  const seatedCount = seatedByTournament.reduce((sum, seats) => sum + seats.length, 0);
  const averageAttendance = seatedCount / tournaments.length;

  const titleCounts = new Map<string, number>();
  tournaments.forEach((tournament, index) => {
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

  const revenue = ledger
    .filter((tx) => tx.status === 'paid')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const entries = ledger.filter((tx) => tx.type !== 'ticket').length;
  const averageCheck = entries > 0 ? revenue / entries : 0;

  const unpaidSum = ledger
    .filter((tx) => tx.status === 'unpaid')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const allSum = ledger.reduce((sum, tx) => sum + tx.amount, 0);
  const debtorPercent = allSum > 0 ? (unpaidSum / allSum) * 100 : 0;

  const checkByPlayerEvent = new Map<string, { amount: number; userId: string; tournamentId: string }>();
  for (const tx of ledger) {
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

  const attendance = new Map<string, { nickname: string; value: number }>();
  const bounty = new Map<string, { nickname: string; value: number }>();

  seatedByTournament.forEach((seats) => {
    for (const participant of seats) {
      const userId = clubSeatId(participant, knownIds);
      if (!userId) continue;
      const nick = nicknameFor(userId, participant.nickname, names);
      bumpLeader(attendance, userId, nick);

      const knockouts = participant.knockouts ?? 0;
      if (knockouts > 0) {
        bumpLeader(bounty, userId, nick, knockouts);
      }
    }
  });

  const attendanceRows = tournaments
    .map((tournament, index) => ({ tournament, players: seatedByTournament[index]!.length }))
    .sort((a, b) => compareByStart(a.tournament, b.tournament));

  const dateCounts = new Map<string, number>();
  for (const { tournament } of attendanceRows) {
    const date = formatAttendanceDate(tournament.startDate);
    dateCounts.set(date, (dateCounts.get(date) ?? 0) + 1);
  }

  const attendanceChart = attendanceRows.map(({ tournament, players }) => {
    const date = formatAttendanceDate(tournament.startDate);
    const time = formatAttendanceTime(tournament.startTime);
    return {
      id: tournament.id,
      label: (dateCounts.get(date) ?? 0) > 1 && time ? `${date} ${time}` : date,
      title: tournament.title,
      players,
    };
  });

  const rebuyCount = ledger.filter((tx) => tx.type === 'rebuy').length;
  const addonCount = ledger.filter((tx) => tx.type === 'addon').length;
  const addonEligibleSeats = tournaments.reduce((sum, tournament, index) => {
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
    topAttendance: topThree(attendance),
    topFinalists: collectTopFinalists(tournaments, knownIds, names),
    topBounty: topThree(bounty),
    tournamentCount: tournaments.length,
    avgRebuys,
    addonRate,
    rebuyCount,
    addonCount,
    seatedCount,
    addonEligibleSeats,
  };
}
