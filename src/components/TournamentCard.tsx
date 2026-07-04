import { Clock } from 'lucide-react';
import type { Tournament } from '../types/tournament';

interface Props {
  tournament: Tournament;
  onClick: (tournament: Tournament) => void;
}


function ImageThumb({ title }: { title: string }) {
  return (
    <div
      className="w-[88px] h-[88px] shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #1A130F 0%, #2d2020 100%)' }}
    >
      <img
        src="/fishka.svg"
        alt={title}
        className="w-16 h-16 object-contain"
        style={{ opacity: 0.8 }}
      />
    </div>
  );
}

export function TournamentCard({ tournament, onClick }: Props) {
  const { title, startDate, startTime, totalSeats, registeredSeats, status } = tournament;

  const seatsLeft   = totalSeats - registeredSeats;
  const isFull      = seatsLeft === 0;
  const isFinished  = status === 'finished';

  // "СУББОТА 5 июля" — uppercase weekday, no comma
  const dateObj      = new Date(startDate);
  const weekday      = dateObj.toLocaleDateString('ru-RU', { weekday: 'long' });
  const dayMonth     = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const weekdayUpper = weekday.toUpperCase();

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
      <div className="flex items-center gap-3 px-4 py-5" style={{ minHeight: 152 }}>
        {/* Left: title + date */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <h3 className="text-white font-800 text-[14px] uppercase tracking-wider leading-tight truncate">
            {title}
          </h3>

          {/* Weekday bold gold + date muted + time */}
          <div className="flex items-center gap-1.5 text-[12px] font-500 flex-wrap">
            <span className="font-700" style={{ color: '#D99962' }}>{weekdayUpper}</span>
            <span style={{ color: '#A39B98' }}>{dayMonth}</span>
            <span className="opacity-25 text-white mx-0.5">·</span>
            <Clock size={11} style={{ color: '#c8a38e' }} />
            <span style={{ color: '#A39B98' }}>{startTime}</span>
          </div>

          {/* Seat count — uniform single colour, no inner contrast */}
          {!isFinished ? (
            <p className="text-[11px] font-500" style={{ color: '#8c8c88' }}>
              {isFull ? 'Мест нет' : `Мест: ${seatsLeft}/${totalSeats}`}
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
