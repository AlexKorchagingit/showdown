import { itmPlaceCount, ratingPointsForPlace } from '../data/prizeStructure';
import type { Participant, Tournament } from '../types/tournament';
import { sanitizeParticipantUserId, unwrapParticipantSeatKey } from './supabaseMap';
import { isArrivedPlayer } from './tournamentArrival';

/** Title (or assigned structure name) contains "TEAM BATTLE". */
export function isTeamBattleEvent(
  tournament: Pick<Tournament, 'title' | 'blindStructure'> | null | undefined,
): boolean {
  if (!tournament) return false;
  return /team battle/i.test(`${tournament.title} ${tournament.blindStructure ?? ''}`);
}

/** Stable seat key used as `teamPartnerId` (`users.id` or `guest-…`). */
export function participantSeatIdentity(
  player: Pick<Participant, 'id' | 'userId'>,
  tournamentId = '',
): string {
  const bound = sanitizeParticipantUserId(player.userId ?? '');
  if (bound) return bound;
  return unwrapParticipantSeatKey(tournamentId, player.id) || player.id;
}

export function findTeamPartner(
  players: readonly Participant[],
  player: Pick<Participant, 'id' | 'userId' | 'teamPartnerId'>,
  tournamentId = '',
): Participant | undefined {
  const partnerId = player.teamPartnerId?.trim();
  if (!partnerId) return undefined;
  const self = participantSeatIdentity(player, tournamentId);
  return players.find((candidate) => {
    const ident = participantSeatIdentity(candidate, tournamentId);
    if (ident === self || candidate.id === player.id) return false;
    return ident === partnerId || candidate.id === partnerId;
  });
}

export function hasAnyTeamPair(players: readonly Participant[]): boolean {
  return players.some((player) => Boolean(player.teamPartnerId?.trim()));
}

function withPartner(player: Participant, partnerId: string | undefined): Participant {
  const next = partnerId?.trim() || undefined;
  if ((player.teamPartnerId || undefined) === next) return player;
  return { ...player, teamPartnerId: next };
}

function sameSeat(
  player: Pick<Participant, 'id' | 'userId'>,
  otherId: string,
  tournamentId: string,
): boolean {
  return player.id === otherId || participantSeatIdentity(player, tournamentId) === otherId;
}

/**
 * Set or clear a mutual A↔B pair. The previous partners of both seats are
 * unpaired. Both seats must already be in the cashier when pairing.
 */
export function setTeamPartner(
  players: Participant[],
  playerId: string,
  partnerId: string | null,
  tournamentId = '',
): Participant[] {
  const self = players.find((player) => sameSeat(player, playerId, tournamentId));
  if (!self) return players;
  const selfIdent = participantSeatIdentity(self, tournamentId);
  const nextPartnerIdent = partnerId?.trim() || '';
  if (nextPartnerIdent && (nextPartnerIdent === selfIdent || nextPartnerIdent === self.id)) {
    return players;
  }

  const target = nextPartnerIdent
    ? players.find((player) => sameSeat(player, nextPartnerIdent, tournamentId))
    : undefined;
  if (nextPartnerIdent && !target) return players;
  if (target && (!isArrivedPlayer(self) || !isArrivedPlayer(target))) return players;

  const targetIdent = target ? participantSeatIdentity(target, tournamentId) : undefined;

  return players.map((player) => {
    const ident = participantSeatIdentity(player, tournamentId);
    const isSelf = player.id === self.id || ident === selfIdent;
    const isTarget = Boolean(target && (player.id === target.id || ident === targetIdent));
    if (isSelf) return withPartner(player, targetIdent);
    if (isTarget) return withPartner(player, selfIdent);
    const pairedWithSelf = player.teamPartnerId === selfIdent || player.teamPartnerId === self.id;
    const pairedWithTarget = Boolean(
      targetIdent && (player.teamPartnerId === targetIdent || player.teamPartnerId === target?.id),
    );
    if (pairedWithSelf || pairedWithTarget) return withPartner(player, undefined);
    return player;
  });
}

/** Drop a seat and break its pair so the leftover partner is solo. */
export function removeSeatKeepingTeams(
  players: Participant[],
  playerId: string,
  tournamentId = '',
): Participant[] {
  return setTeamPartner(players, playerId, null, tournamentId).filter(
    (player) => !sameSeat(player, playerId, tournamentId),
  );
}

/** After binding a guest to a club account, rewrite partner pointers to the new id. */
export function rebindTeamPartnerIdentity(
  players: Participant[],
  fromId: string,
  toId: string,
): Participant[] {
  const next = toId.trim();
  const previous = fromId.trim();
  if (!next || !previous || next === previous) return players;
  return players.map((player) => {
    if (player.teamPartnerId !== previous && player.teamPartnerId !== fromId) return player;
    return withPartner(player, next);
  });
}

/** Unique mutual pairs among cashier seats. The leftover odd player stays solo. */
export function assignRandomTeamPairs(
  players: Participant[],
  tournamentId = '',
  random: () => number = Math.random,
): Participant[] {
  const ids = players.filter(isArrivedPlayer).map((player) => player.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    const current = ids[index]!;
    ids[index] = ids[swapWith]!;
    ids[swapWith] = current;
  }
  let next = players.map((player) => withPartner(player, undefined));
  for (let index = 0; index + 1 < ids.length; index += 2) {
    next = setTeamPartner(next, ids[index]!, ids[index + 1]!, tournamentId);
  }
  return next;
}

/**
 * One place per team: finished teams are ranked 1, 2, 3… by their better
 * individual place (holes from the worse teammate are compacted). A still-
 * playing partner keeps the team off the board. Solo players are a team of one.
 */
function teamKey(
  player: Pick<Participant, 'id' | 'userId' | 'teamPartnerId'>,
  players: readonly Participant[],
  tournamentId: string,
): string {
  const self = participantSeatIdentity(player, tournamentId);
  const partner = findTeamPartner(players, player, tournamentId);
  if (!partner) return self;
  const other = participantSeatIdentity(partner, tournamentId);
  return self < other ? `${self}\0${other}` : `${other}\0${self}`;
}

function individualPlace(player: Participant | undefined): number | undefined {
  if (!player || typeof player.place !== 'number' || player.place < 1) return undefined;
  return player.place;
}

/** Better individual place of a fully finished team; undefined if the team is still alive. */
export function teamMinPlace(
  player: Participant,
  players: readonly Participant[],
  tournamentId = '',
): number | undefined {
  const own = individualPlace(player);
  if (own == null) return undefined;
  const partner = findTeamPartner(players, player, tournamentId);
  if (!partner) return own;
  const partnerPlace = individualPlace(partner);
  if (partnerPlace == null) return undefined;
  return Math.min(own, partnerPlace);
}

function aliveTeamCount(players: readonly Participant[], tournamentId: string): number {
  const keys = new Set<string>();
  for (const player of players) {
    if (!isArrivedPlayer(player) && individualPlace(player) == null) continue;
    if (teamMinPlace(player, players, tournamentId) != null) continue;
    keys.add(teamKey(player, players, tournamentId));
  }
  return keys.size;
}

export function teamScoringPlace(
  player: Participant,
  players: readonly Participant[],
  tournamentId = '',
): number | undefined {
  const min = teamMinPlace(player, players, tournamentId);
  if (min == null) return undefined;
  const finishedMins = [
    ...new Set(
      players.flatMap((candidate) => {
        const value = teamMinPlace(candidate, players, tournamentId);
        return value != null ? [value] : [];
      }),
    ),
  ].sort((left, right) => left - right);
  const rankAmongFinished = finishedMins.indexOf(min) + 1;
  if (rankAmongFinished < 1) return undefined;
  return aliveTeamCount(players, tournamentId) + rankAmongFinished;
}

export function displayedTeamPlace(
  player: Participant,
  tournament: Pick<Tournament, 'id' | 'title' | 'blindStructure' | 'participants'>,
): number | undefined {
  if (!isTeamBattleEvent(tournament)) {
    return typeof player.place === 'number' && player.place >= 1 ? player.place : undefined;
  }
  return (
    teamScoringPlace(player, tournament.participants, tournament.id) ??
    (typeof player.place === 'number' && player.place >= 1 ? player.place : undefined)
  );
}

/** Floor-half each when paired; leftover odd point is dropped so both get the same. */
export function splitTeamPlacePoints(
  pool: number,
  _ownPlace: number,
  partnerPlace: number | undefined,
): number {
  if (pool <= 0) return 0;
  if (partnerPlace == null || partnerPlace < 1) return pool;
  return Math.floor(pool / 2);
}

export function teamRatingPointsForPlayer(
  player: Participant,
  tournament: Pick<Tournament, 'id' | 'title' | 'blindStructure' | 'guarantee' | 'participants'>,
  fieldSize: number,
): number {
  if (!isTeamBattleEvent(tournament)) {
    return typeof player.place === 'number'
      ? ratingPointsForPlace(player.place, tournament.guarantee, fieldSize)
      : 0;
  }
  const teamPlace = teamScoringPlace(player, tournament.participants, tournament.id);
  if (teamPlace == null) return 0;
  const pool = ratingPointsForPlace(teamPlace, tournament.guarantee, fieldSize);
  const partner = findTeamPartner(tournament.participants, player, tournament.id);
  const partnerPlace =
    partner && typeof partner.place === 'number' && partner.place >= 1 ? partner.place : undefined;
  const ownPlace = typeof player.place === 'number' && player.place >= 1 ? player.place : teamPlace;
  return splitTeamPlacePoints(pool, ownPlace, partnerPlace);
}

/** Final table = ITM places + 1 (bubble). */
export function teamBattleFinalTableSize(fieldSize: number): number {
  const itm = itmPlaceCount(fieldSize);
  return itm > 0 ? itm + 1 : 0;
}

export function teamPrizeAtPlace(
  tournament: Pick<Tournament, 'id' | 'title' | 'blindStructure' | 'guarantee' | 'participants'>,
  place: number,
  fieldSize: number,
): { names: string[]; pointsEach: number } | undefined {
  if (!isTeamBattleEvent(tournament) || place < 1) return undefined;
  const members = tournament.participants.filter(
    (player) => teamScoringPlace(player, tournament.participants, tournament.id) === place,
  );
  if (members.length === 0) return undefined;
  const names = [
    ...new Map(
      members.map((player) => [participantSeatIdentity(player, tournament.id), player.nickname] as const),
    ).values(),
  ].sort((left, right) => left.localeCompare(right, 'ru'));
  const pool = ratingPointsForPlace(place, tournament.guarantee, fieldSize);
  const pointsEach = names.length > 1 ? Math.floor(pool / 2) : pool;
  return { names, pointsEach };
}
