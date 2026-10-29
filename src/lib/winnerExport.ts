import { knockoutBountyPoints, ratingPointsForPlace } from '../data/prizeStructure';
import { isSquadScoreEvent, squadAwards, squadBoardActive, squadTeamPlace } from './squadScores';
import { displayedTeamPlace, isTeamBattleEvent, teamRatingPointsForPlayer } from './teamBattle';
import type { Participant, Tournament } from '../types/tournament';

export type WinnerExportRow = {
  place: number | null;
  nickname: string;
  points: number;
  knockoutPoints: number;
};

type ExportTournament = Pick<
  Tournament,
  'id' | 'title' | 'blindStructure' | 'guarantee' | 'participants' | 'isBounty' | 'isClosed'
>;

function placeOf(player: Participant, tournament: ExportTournament): number | null {
  if (isSquadScoreEvent(tournament)) {
    return squadTeamPlace(player, tournament.participants) ??
      (typeof player.place === 'number' && player.place >= 1 ? player.place : null);
  }
  return displayedTeamPlace(player, tournament) ?? null;
}

function placePoints(player: Participant, tournament: ExportTournament, fieldSize: number): number {
  if (isSquadScoreEvent(tournament) && squadBoardActive(tournament.participants)) {
    return squadAwards(tournament.participants, tournament.guarantee).awardById.get(player.id) ?? 0;
  }
  if (isTeamBattleEvent(tournament)) {
    return teamRatingPointsForPlayer(player, tournament, fieldSize);
  }
  return typeof player.place === 'number'
    ? ratingPointsForPlace(player.place, tournament.guarantee, fieldSize)
    : 0;
}

/** Every listed player, in finishing order. Knockout points stay separate from the place award. */
export function winnerExportRows(
  players: readonly Participant[],
  tournament: ExportTournament,
  fieldSize: number,
): WinnerExportRow[] {
  const rows: WinnerExportRow[] = [];
  for (const player of players) {
    const points = placePoints(player, tournament, fieldSize);
    const knockoutPoints = knockoutBountyPoints(player.knockouts, tournament.isBounty === true);
    rows.push({
      place: placeOf(player, tournament),
      nickname: player.nickname.trim() || '—',
      points,
      knockoutPoints,
    });
  }
  return rows.sort((a, b) => {
    const placeA = a.place ?? Number.POSITIVE_INFINITY;
    const placeB = b.place ?? Number.POSITIVE_INFINITY;
    if (placeA !== placeB) return placeA - placeB;
    return a.nickname.localeCompare(b.nickname, 'ru');
  });
}

/** Grouped digits with a normal space, so a paste does not carry a hidden separator. */
export function formatWinnerPoints(points: number): string {
  return Math.max(0, Math.round(points)).toLocaleString('ru-RU').replace(/[\u00a0\u202f]/g, ' ');
}

/**
 * A word joiner after the dot keeps "1. Имя" as plain text.
 * Messengers otherwise turn "1. " into a list and drop the space.
 */
const NUMBER_GAP = '\u2060 ';

/** Place points and knockout points worth showing. A rounded zero is omitted. */
export function winnerExportScore(row: Pick<WinnerExportRow, 'points' | 'knockoutPoints'>): {
  points: string;
  knockout: string;
} {
  const points = Math.round(Number(row.points) || 0);
  const knockout = Math.round(Number(row.knockoutPoints) || 0);
  return {
    points: points > 0 ? formatWinnerPoints(points) : '',
    knockout: knockout > 0 ? formatWinnerPoints(knockout) : '',
  };
}

export function winnerExportLine(row: WinnerExportRow, index: number): string {
  const number = row.place ?? index + 1;
  const score = winnerExportScore(row);
  let tail = '';
  if (score.points) tail = ` — ${score.points}${score.knockout ? ` +${score.knockout}` : ''}`;
  else if (score.knockout) tail = ` +${score.knockout}`;
  return `${number}.${NUMBER_GAP}${row.nickname}${tail}`.replace(/[ \t]*[—–−-][ \t]*0(?!\d)/g, '');
}

export function winnerExportText(rows: readonly WinnerExportRow[]): string {
  return rows.map((row, index) => winnerExportLine(row, index)).join('\n');
}
