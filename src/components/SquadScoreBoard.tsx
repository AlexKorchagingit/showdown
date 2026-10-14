import { useMemo, useState } from 'react';
import type { Participant, Tournament } from '../types/tournament';
import { PlayerNameLink } from './PlayerNameLink';
import { cashierFieldSize } from '../lib/tournamentArrival';
import {
  eventRatingAward,
  squadAwards,
  squadBoardActive,
  squadNoOf,
  squadPointsOf,
  squadTeamsByPoints,
  SQUAD_TEAM_COUNT,
} from '../lib/squadScores';

type Draft = { squadNo: number | null; points: string };

function parsePoints(raw: string): number {
  const cleaned = raw.trim().replace(',', '.');
  if (!cleaned) return 0;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(1_000_000, Math.floor(value));
}

function draftFrom(players: readonly Participant[]): Record<string, Draft> {
  const draft: Record<string, Draft> = {};
  for (const player of players) {
    const points = squadPointsOf(player);
    draft[player.id] = {
      squadNo: squadNoOf(player),
      points: points > 0 ? String(points) : '',
    };
  }
  return draft;
}

export type SquadScoreDraft = { id: string; squadNo: number | null; points: number };

/**
 * Six teams for the 13 Oct 2026 freeroll only.
 * Очки are informational. Рейтинг is the guarantee split by those team totals.
 */
export function SquadScoreBoard({
  tournament,
  players,
  editable = false,
  saving = false,
  onSave,
}: {
  tournament: Tournament;
  players: readonly Participant[];
  editable?: boolean;
  saving?: boolean;
  onSave?: (rows: SquadScoreDraft[]) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<Record<string, Draft>>(() => draftFrom(tournament.participants));
  const preview = useMemo(() => {
    if (!editable) return tournament.participants;
    return tournament.participants.map((player) => {
      const row = draft[player.id];
      if (!row) return player;
      const points = parsePoints(row.points);
      return {
        ...player,
        squadNo: row.squadNo ?? undefined,
        squadPoints: points > 0 ? points : undefined,
      };
    });
  }, [draft, editable, tournament.participants]);
  const awards = useMemo(
    () => squadAwards(preview, tournament.guarantee),
    [preview, tournament.guarantee],
  );
  const boardOn = squadBoardActive(preview);
  const field = Math.max(cashierFieldSize(tournament), 1);

  const ratingOf = (player: Participant) => {
    if (boardOn) return awards.awardById.get(player.id) ?? 0;
    return eventRatingAward(player, tournament, field);
  };

  const squadOf = (player: Participant) => {
    if (!editable) return squadNoOf(player);
    return draft[player.id]?.squadNo ?? null;
  };

  const pointsText = (player: Participant) => {
    if (editable) return draft[player.id]?.points ?? '';
    const points = squadPointsOf(player);
    return points > 0 ? points.toLocaleString('ru-RU') : '—';
  };

  const ordered = (team: number | null) =>
    players
      .filter((player) => squadOf(player) === team)
      .slice()
      .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ru'));

  const save = () => {
    if (!onSave) return;
    const rows = tournament.participants.map((player) => ({
      id: player.id,
      squadNo: draft[player.id]?.squadNo ?? null,
      points: parsePoints(draft[player.id]?.points ?? ''),
    }));
    void onSave(rows);
  };

  const setTeam = (id: string, raw: string) => {
    const squadNo = raw === '' ? null : Number(raw);
    setDraft((current) => ({
      ...current,
      [id]: { squadNo: squadNo != null && squadNo >= 1 && squadNo <= 6 ? squadNo : null, points: current[id]?.points ?? '' },
    }));
  };

  const setPoints = (id: string, points: string) => {
    if (points !== '' && !/^\d{0,7}$/.test(points)) return;
    setDraft((current) => ({
      ...current,
      [id]: { squadNo: current[id]?.squadNo ?? null, points },
    }));
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 className="text-sm font-bold text-white uppercase">Команды</h3>
        {!tournament.isClosed || !boardOn ? (
          <p className="mt-2 text-[12px] leading-relaxed" style={{ color: '#A39B98' }}>
            {!tournament.isClosed ? 'В общий рейтинг это попадёт после закрытия турнира. ' : ''}
            {!boardOn ? 'Пока никого нет в команде, в столбце рейтинга остаются прежние очки за места.' : ''}
          </p>
        ) : null}
      </div>
      {squadTeamsByPoints(awards.teamPoints).map((team) => (
        <TeamBlock
          key={team}
          title={`Команда ${team}`}
          total={awards.teamPoints[team] ?? 0}
          players={ordered(team)}
          editable={editable}
          pointsText={pointsText}
          ratingOf={ratingOf}
          squadOf={squadOf}
          onTeam={setTeam}
          onPoints={setPoints}
        />
      ))}
      <TeamBlock
        title="Без команды"
        total={null}
        players={ordered(null)}
        editable={editable}
        pointsText={pointsText}
        ratingOf={ratingOf}
        squadOf={squadOf}
        onTeam={setTeam}
        onPoints={setPoints}
      />
      {editable ? (
        <div className="px-5 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="w-full py-3 rounded-xl text-[14px] font-700 text-white disabled:opacity-60"
            style={{ background: '#463129', border: '1px solid #D99962' }}
          >
            {saving ? 'Сохраняем…' : 'Сохранить команды'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TeamBlock({
  title,
  total,
  players,
  editable,
  pointsText,
  ratingOf,
  squadOf,
  onTeam,
  onPoints,
}: {
  title: string;
  total: number | null;
  players: Participant[];
  editable: boolean;
  pointsText: (player: Participant) => string;
  ratingOf: (player: Participant) => number;
  squadOf: (player: Participant) => number | null;
  onTeam: (id: string, raw: string) => void;
  onPoints: (id: string, points: string) => void;
}) {
  if (!editable && players.length === 0 && total === null) return null;
  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between gap-3 px-5 py-2.5">
        <span className="text-[12px] font-700 uppercase tracking-[0.14em]" style={{ color: '#F2D8A7' }}>
          {title}
        </span>
        {total != null ? (
          <span className="text-[12px] font-700" style={{ color: '#D99962' }}>
            {total.toLocaleString('ru-RU')} очков
          </span>
        ) : null}
      </div>
      {players.length > 0 ? (
        <div
          className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 px-5 pb-1 text-[10px] font-700 uppercase tracking-[0.12em]"
          style={{ color: '#6B6360' }}
        >
          <span>Ник</span>
          <span className="text-right">Очки</span>
          <span className="text-right">Рейтинг</span>
        </div>
      ) : editable ? (
        <p className="px-5 pb-3 text-[12px]" style={{ color: '#6B6360' }}>
          Пока никого
        </p>
      ) : null}
      {players.map((player) => (
        <div key={player.id} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 px-5 py-2">
          <div className="min-w-0">
            {editable ? (
              <select
                aria-label={`Команда для ${player.nickname}`}
                value={squadOf(player) ?? ''}
                onChange={(event) => onTeam(player.id, event.target.value)}
                className="mb-1 block max-w-full rounded-md px-1 py-0.5 text-[11px] font-700"
                style={{ background: '#1A1411', color: '#D99962', border: '1px solid rgba(217,153,98,0.35)' }}
              >
                <option value="">Без команды</option>
                {Array.from({ length: SQUAD_TEAM_COUNT }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    Команда {index + 1}
                  </option>
                ))}
              </select>
            ) : null}
            <PlayerNameLink
              id={player.id}
              nickname={player.nickname}
              className="block truncate text-[13px] font-600 text-white"
            />
          </div>
          {editable ? (
            <input
              inputMode="numeric"
              aria-label={`Очки ${player.nickname}`}
              value={pointsText(player)}
              onChange={(event) => onPoints(player.id, event.target.value)}
              className="w-full rounded-md px-1 py-1 text-right text-[13px] font-700 text-white"
              style={{ background: '#1A1411', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          ) : (
            <span className="text-right text-[13px] font-700 text-white">{pointsText(player)}</span>
          )}
          <span className="text-right text-[13px] font-700" style={{ color: '#D99962' }}>
            {ratingOf(player).toLocaleString('ru-RU')}
          </span>
        </div>
      ))}
    </div>
  );
}
