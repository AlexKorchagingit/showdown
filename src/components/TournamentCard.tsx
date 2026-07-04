import { Clock } from 'lucide-react';
import type { Tournament } from '../types/tournament';

interface Props {
  tournament: Tournament;
  onClick: (tournament: Tournament) => void;
}

// Decorative suit characters for the image placeholder
const SUITS = ['♠', '♥', '♦', '♣'];

function ImageThumb({ title }: { title: string }) {
  return (
    <div
      className="w-[88px] h-[88px] shrink-0 rounded-xl overflow-hidden relative flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #1A130F 0%, #3a2520 100%)' }}
    >
      {SUITS.slice(0, 2).map((s, i) => (
        <span
          key={i}
          className="absolute select-none"
          style={{
            color: '#c8a38e', opacity: 0.12,
            fontSize: `${18 + i * 10}px`,
            top: `${[8, 48][i]}%`, left: `${[10, 50][i]}%`,
            transform: `rotate(${[-12, 15][i]}deg)`,
          }}
        >
          {s}
        </span>
      ))}
      <span
        className="relative z-10 text-[32px] leading-none"
        style={{ color: '#D99962', opacity: 0.45 }}
      >
        ♠
      </span>
      {/* small title overlay */}
      <p
        className="absolute bottom-1.5 left-0 right-0 text-center text-[8px] font-700 uppercase tracking-widest px-1 truncate"
        style={{ color: '#c8a38e', opacity: 0.7 }}
      >
        {title.split(' ')[0]}
      </p>
    </div>
  );
}

export function TournamentCard({ tournament, onClick }: Props) {
  const { title, startDate, startTime, totalSeats, registeredSeats, status } = tournament;

  const seatsLeft   = totalSeats - registeredSeats;
  const isFull      = seatsLeft === 0;
  const isFinished  = status === 'finished';

  // "Суббота, 5 июля"
  const dateObj    = new Date(startDate);
  const weekday    = dateObj.toLocaleDateString('ru-RU', { weekday: 'long' });
  const dayMonth   = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  return (
    <button
      onClick={() => onClick(tournament)}
      className="w-full text-left rounded-2xl overflow-hidden active:scale-[0.98] transition-transform duration-150"
      style={{
        background: 'linear-gradient(180deg, #2A211D 0%, #1E1612 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.35)',
      }}
    >
      {/* Horizontal layout: text left, image right */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Left: title + date */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <h3 className="text-white font-700 text-[14px] uppercase tracking-wide leading-tight truncate">
            {title}
          </h3>

          {/* Weekday bold gold + date muted + time */}
          <div className="flex items-center gap-1.5 text-[12px] font-500 flex-wrap">
            <span className="font-700" style={{ color: '#D99962' }}>{weekdayCap}</span>
            <span style={{ color: '#A39B98' }}>, {dayMonth}</span>
            <span className="opacity-25 text-white mx-0.5">·</span>
            <Clock size={11} style={{ color: '#c8a38e' }} />
            <span style={{ color: '#A39B98' }}>{startTime}</span>
          </div>

          {/* Seat count — compact single line */}
          {!isFinished ? (
            <p className="text-[11px] font-500" style={{ color: isFull ? '#ef4444' : '#6B6360' }}>
              {isFull
                ? 'Мест нет'
                : <>Мест: <span className="text-white font-700">{seatsLeft}</span>/{totalSeats}</>}
            </p>
          ) : (
            <p className="text-[11px] font-500" style={{ color: '#6B6360' }}>Завершён</p>
          )}
        </div>

        {/* Right: square thumbnail */}
        <ImageThumb title={title} />
      </div>
    </button>
  );
}
