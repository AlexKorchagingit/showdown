import { Clock } from 'lucide-react';
import type { Tournament } from '../types/tournament';
import { isTournamentPast } from '../lib/tournamentStatus';
import { asset } from '../lib/assets';

interface Props {
  tournament: Tournament;
  onClick: (tournament: Tournament) => void;
}

export function TournamentCard({ tournament, onClick }: Props) {
  const { title, startDate, startTime, totalSeats, participants } = tournament;

  const seatsLeft  = Math.max(0, totalSeats - participants.length);
  const isFull     = seatsLeft === 0;
  const isPast     = isTournamentPast(startDate, startTime);

  // "СУББОТА 5 июля" — uppercase weekday, no comma
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
      {/* Background fishka — same style as Home hero card */}
      <img
        src={asset("/fishka.svg")}
        alt=""
        aria-hidden
        className="absolute w-auto z-0 pointer-events-none select-none"
        style={{
          height: '160%',
          right: '-20%',
          top: '-30%',
          opacity: 0.55,
          filter: 'brightness(1.5) contrast(1.4) saturate(1.2)',
        }}
      />

      {/* Gradient overlay — left solid, right transparent */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(to right, #1d0b07 0%, rgba(29,11,7,0.6) 55%, transparent 100%)',
        }}
      />

      {/* Content — 68% wide, over the gradient */}
      <div
        className="relative z-20 flex flex-col justify-between px-5 py-4"
        style={{ width: '68%', minHeight: 140 }}
      >
        {/* Title */}
        <h3
          className="text-white font-black text-[18px] uppercase leading-tight"
          style={{ letterSpacing: '0.04em' }}
        >
          {title}
        </h3>

        {/* Date + time + seats */}
        <div className="space-y-1 mt-3">
          <div className="flex items-center gap-1.5 text-[12px] flex-wrap">
            <span className="font-700" style={{ color: '#D99962' }}>{weekdayUpper}</span>
            <span style={{ color: 'rgba(255,255,255,0.8)' }}>{dayMonth}</span>
            <span className="opacity-30 text-white mx-0.5">·</span>
            <Clock size={11} style={{ color: '#c8a38e' }} />
            <span style={{ color: 'rgba(255,255,255,0.8)' }}>{startTime}</span>
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
