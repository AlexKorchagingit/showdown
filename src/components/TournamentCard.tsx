import { Clock, MapPin } from 'lucide-react';
import type { Tournament } from '../types/tournament';
import { isTournamentPast } from '../lib/tournamentStatus';
import { CLUB_ADDRESS_CITY, CLUB_ADDRESS_STREET } from '../lib/clubAddress';

interface Props {
  tournament: Tournament;
  onClick: (tournament: Tournament) => void;
}

export function TournamentCard({ tournament, onClick }: Props) {
  const { title, startDate, startTime, totalSeats, participants } = tournament;

  const seatsLeft  = Math.max(0, totalSeats - participants.length);
  const isFull     = seatsLeft === 0;
  const isPast     = isTournamentPast(startDate, startTime);

  const dateObj      = new Date(startDate);
  const weekday      = dateObj.toLocaleDateString('ru-RU', { weekday: 'long' });
  const dayMonth     = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const weekdayUpper = weekday.toUpperCase();

  return (
    <button
      onClick={() => onClick(tournament)}
      className="relative w-full text-left rounded-2xl overflow-hidden active:scale-[0.98] transition-transform duration-150"
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
          className="absolute top-1/2 -translate-y-1/2 right-[-5%] h-[130%] w-auto max-w-none object-right object-contain pointer-events-none select-none origin-right scale-100 bg-transparent border-0 shadow-none ring-0 outline-none"
          style={{
            opacity: 0.85,
            filter: 'brightness(1.08) contrast(1.04) saturate(1.04)',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            background: 'transparent',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black)',
            maskImage: 'linear-gradient(to right, transparent, black)',
          }}
        />
        <div className="absolute inset-0 pointer-events-none border-0 shadow-none ring-0 bg-gradient-to-r from-[#1d0b07] from-[30%] via-[#1d0b07]/60 via-[50%] to-transparent" />
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

        <div className="space-y-1 mt-3">
          <div className="flex flex-col gap-1 text-[12px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-700" style={{ color: '#D99962' }}>{weekdayUpper}</span>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>{dayMonth}</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
              <Clock size={11} style={{ color: '#c8a38e' }} />
              <span>{startTime}</span>
            </div>
          </div>

          <div className="flex items-start gap-1.5 text-[11px]" style={{ color: '#8c8c88' }}>
            <MapPin size={11} className="shrink-0 mt-0.5" style={{ color: '#c8a38e' }} />
            <span className="whitespace-normal break-words text-wrap">
              {CLUB_ADDRESS_CITY}
              <br />
              {CLUB_ADDRESS_STREET}
            </span>
          </div>

          <p className="text-[11px] font-500" style={{ color: '#8c8c88' }}>
            {isFull ? 'Мест нет' : `Мест: ${seatsLeft}/${totalSeats}`}
            {isPast && ' · Завершён'}
          </p>
        </div>
      </div>
    </button>
  );
}
