import type { Participant } from '../types/tournament';
import {
  FINAL_DRAW_SEATS_PER_TABLE,
  FINAL_DRAW_TABLES,
  finalDrawBox,
  finalDrawLabel,
  finalDrawNames,
  isFinalDrawEvent,
} from '../lib/finalDraw';

export function FinalDrawNickLine({
  tournamentId,
  box,
}: {
  tournamentId: string;
  box?: number;
}) {
  if (!isFinalDrawEvent({ id: tournamentId })) return null;
  const label = finalDrawLabel(box);
  if (!label) return null;
  return (
    <p className="text-[11px] mt-0.5 truncate" style={{ color: '#F2D8A7' }}>
      {label}
    </p>
  );
}

export function FinalDrawBoard({
  tournamentId,
  players,
}: {
  tournamentId: string;
  players: readonly Participant[];
}) {
  if (!isFinalDrawEvent({ id: tournamentId })) return null;
  const names = finalDrawNames(players);
  const drawn = names.size;

  return (
    <section
      className="rounded-2xl p-4 space-y-3"
      style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[12px] font-700 uppercase tracking-[0.2em]" style={{ color: '#F2D8A7' }}>
          Рассадка
        </h3>
        <span className="text-[11px] font-600" style={{ color: '#A39B98' }}>
          {drawn} / {FINAL_DRAW_TABLES * FINAL_DRAW_SEATS_PER_TABLE}
        </span>
      </div>
      <div className="space-y-3">
        {Array.from({ length: FINAL_DRAW_TABLES }, (_, tableIndex) => {
          const table = tableIndex + 1;
          return (
            <div key={table}>
              <p className="text-[11px] font-700 mb-1.5" style={{ color: '#D99962' }}>
                Стол {table}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: FINAL_DRAW_SEATS_PER_TABLE }, (_, seatIndex) => {
                  const seat = seatIndex + 1;
                  const box = finalDrawBox(table, seat)!;
                  const nickname = names.get(box);
                  return (
                    <div
                      key={box}
                      className="min-w-0 rounded-lg px-1.5 py-1.5"
                      style={{
                        background: nickname ? 'rgba(217,153,98,0.16)' : '#231A16',
                        border: nickname
                          ? '1px solid rgba(217,153,98,0.45)'
                          : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <p className="text-[10px] font-700 leading-none" style={{ color: '#D99962' }}>
                        {seat}
                      </p>
                      <p
                        className="text-[10px] font-600 truncate mt-1 leading-tight"
                        style={{ color: nickname ? '#ffffff' : '#6B6360' }}
                      >
                        {nickname ?? 'свободно'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
