import { startOfDay } from './financePeriod';
import { playerNickname } from './playerName';
import { isFinished } from './tournamentStatus';
import type { Transaction } from '../types/finance';
import type { Tournament } from '../types/tournament';

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
  attendanceChart: { label: string; players: number }[];
  topAttendance: ClubLeader[];
  topFinalists: ClubLeader[];
  topBounty: ClubLeader[];
  tournamentCount: number;
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
  return tournaments.filter((tournament) => {
    if (formatTitle !== 'all' && tournament.title !== formatTitle) return false;
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

function bumpLeader(
  map: Map<string, { nickname: string; value: number }>,
  playerId: string,
  nickname: string,
  delta = 1,
): void {
  const id = String(playerId ?? '').trim() || nickname;
  if (!id) return;
  const row = map.get(id) ?? { nickname: nickname || id, value: 0 };
  row.value += delta;
  if (nickname) row.nickname = nickname;
  map.set(id, row);
}

export function computeClubStatistics(
  tournaments: Tournament[],
  transactions: Transaction[],
): ClubStatistics {
  if (tournaments.length === 0) return EMPTY_STATS;

  const tournamentIds = new Set(tournaments.map((tournament) => tournament.id));
  const titleById = new Map(tournaments.map((tournament) => [tournament.id, tournament.title]));
  const ledger = transactions.filter((tx) => tournamentIds.has(tx.tournamentId));

  const attendanceSum = tournaments.reduce(
    (sum, tournament) => sum + tournament.participants.length,
    0,
  );
  const averageAttendance = attendanceSum / tournaments.length;

  const titleCounts = new Map<string, number>();
  for (const tournament of tournaments) {
    titleCounts.set(
      tournament.title,
      (titleCounts.get(tournament.title) ?? 0) + tournament.participants.length,
    );
  }
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
        nickname: playerNickname(row.userId),
        tournament: titleById.get(row.tournamentId) ?? row.tournamentId,
      };
    }
  }

  const attendance = new Map<string, { nickname: string; value: number }>();
  const finalists = new Map<string, { nickname: string; value: number }>();
  const bounty = new Map<string, { nickname: string; value: number }>();

  for (const tournament of tournaments) {
    for (const participant of tournament.participants) {
      const nick = participant.nickname || playerNickname(participant.id);
      bumpLeader(attendance, participant.id, nick);

      const knockouts = participant.knockouts ?? 0;
      if (knockouts > 0) {
        bumpLeader(bounty, participant.id, nick, knockouts);
      }
    }

    if (!isFinished(tournament)) continue;

    for (const participant of tournament.participants) {
      const place = parseFinishingPlace(participant.place);
      if (place == null || place < 1 || place > 9) continue;
      const nick = participant.nickname || playerNickname(participant.id);
      bumpLeader(finalists, participant.id, nick);
    }
  }

  const attendanceChart = tournaments.map((tournament) => ({
    label:
      tournament.title.length > 12 ? `${tournament.title.slice(0, 11)}…` : tournament.title,
    players: tournament.participants.length,
  }));

  return {
    averageAttendance,
    popularTournament,
    averageCheck,
    debtorPercent,
    biggestCheck,
    attendanceChart,
    topAttendance: topThree(attendance),
    topFinalists: topThree(finalists),
    topBounty: topThree(bounty),
    tournamentCount: tournaments.length,
  };
}
