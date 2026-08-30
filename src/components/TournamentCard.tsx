import { ChevronRight, Clock } from 'lucide-react';
import type { Tournament } from '../types/tournament';
import { isFinished } from '../lib/tournamentStatus';
import { tournamentArtClassName, TOURNAMENT_ART_FADE, TOURNAMENT_ART_MASK } from '../lib/tournamentArt';
import { TimerRunningBadge } from './TimerRunningBadge';
import { useUser } from '../context/UserContext';
import { clubUserIdSet, countOccupiedLobbySeats } from '../lib/clubRating';

interface Props {
  tournament: Tournament;
  onClick: (tournament: Tournament) => void;
  timerRunning?: boolean;
}

function occupiedSeatsClass(occupiedSeats: number): string {
  if (occupiedSeats >= 23) return 'text-red-500 font-bold';
  if (occupiedSeats >= 15) return 'text-[#D99962] font-bold';
  return 'text-white';
}

export function TournamentCard({ tournament, onClick, timerRunning = false }: Props) {
  const { title, startDate, startTime, totalSeats, participants } = tournament;
  const { clubUsers } = useUser();

  const occupiedSeats = countOccupiedLobbySeats(participants, clubUserIdSet(clubUsers));
  const isPast = isFinished(tournament);

  const dateObj = new Date(startDate);
  const weekday = dateObj.toLocaleDateString('ru-RU', { weekday: 'long' });
  const dayMonth = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const weekdayUpper = weekday.toUpperCase();

  return (
    <button
      onClick={() => onClick(tournament)}
      className="relative w-full text-left rounded-2xl overflow-hidden active:scale-[0.98] transition-transform duration-200"
      style={{
        background: '#1d0b07',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 2px 20px rgba(0,0,0,0.45)',
        minHeight: 140,
      }}
    >
      {/* Fully transparent art wrapper — no bg / border / ring / shadow */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-transparent border-0 shadow-none ring-0 outline-none">
        <img
          src={tournament.imageUrl}
          alt=""
          aria-hidden
          className={tournamentArtClassName(tournament.id)}
          style={{
            opacity: 0.85,
            filter: 'brightness(1.08) contrast(1.04) saturate(1.04)',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            background: 'transparent',
            ...TOURNAMENT_ART_MASK,
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none border-0 shadow-none ring-0"
          style={TOURNAMENT_ART_FADE}
        />
      </div>

      <div
        className="relative z-20 flex flex-col justify-between px-5 py-4"
        style={{ width: '68%', minHeight: 140 }}
      >
        <h3
          className="text-white font-black text-[18px] uppercase leading-tight"
          style={{ letterSpacing: '0.04em' }}
        >
          {title}
        </h3>

        <div className="space-y-2 mt-3">
          <div className="flex flex-col gap-2 text-[12px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-700" style={{ color: '#D99962' }}>{weekdayUpper}</span>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>{dayMonth}</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
              <Clock size={11} style={{ color: '#c8a38e' }} />
              <span>{startTime}</span>
            </div>
          </div>

          {!isPast && (
            <p className="text-sm font-medium">
              В игре:{' '}
              <span className={occupiedSeatsClass(occupiedSeats)}>
                {occupiedSeats}/{totalSeats}
              </span>
            </p>
          )}
        </div>
      </div>

      <ChevronRight
        size={18}
        strokeWidth={2}
        aria-hidden
        className="absolute z-20 bottom-3 right-3 pointer-events-none text-white/30"
      />

      {timerRunning ? (
        <div className="absolute z-30 top-3 right-3">
          <TimerRunningBadge />
        </div>
      ) : null}
    </button>
  );
}
