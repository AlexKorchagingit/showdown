import { Clock, Users } from 'lucide-react';
import type { Tournament } from '../types/tournament';

interface Props {
  tournament: Tournament;
  onClick: (tournament: Tournament) => void;
}

function ImagePlaceholder({ title }: { title: string }) {
  return (
    <div
      className="relative w-full h-36 overflow-hidden flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #2A211D 0%, #3a2520 50%, #1E1612 100%)' }}
    >
      {['♠','♥','♦','♣'].map((s, i) => (
        <span key={i} className="absolute select-none"
          style={{ color: '#F2D8A7', opacity: 0.07,
            fontSize: `${22 + (i % 3) * 10}px`,
            top: `${[10,50,20,60][i]}%`, left: `${[10,70,40,25][i]}%`,
            transform: `rotate(${[-15,20,-5,10][i]}deg)` }}
        >{s}</span>
      ))}
      <div className="relative z-10 text-center px-4">
        <div className="text-[34px] mb-1" style={{ color: '#D99962', opacity: 0.38 }}>♠</div>
        <p className="text-white font-700 text-[11px] tracking-widest uppercase opacity-65 leading-tight">
          {title}
        </p>
      </div>
    </div>
  );
}

export function TournamentCard({ tournament, onClick }: Props) {
  const { title, startDate, startTime, totalSeats, registeredSeats, status } = tournament;

  const seatsLeft   = totalSeats - registeredSeats;
  const isFull      = seatsLeft === 0;
  const fillPercent = Math.round((registeredSeats / totalSeats) * 100);

  // Full weekday + day + month  →  "Суббота, 5 июля"
  const dateObj   = new Date(startDate);
  const weekday   = dateObj.toLocaleDateString('ru-RU', { weekday: 'long' });
  const dayMonth  = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  return (
    <button
      onClick={() => onClick(tournament)}
      className="w-full text-left rounded-2xl overflow-hidden active:scale-[0.98] transition-transform duration-150"
      style={{
        background: 'linear-gradient(180deg, #2A211D 0%, #1E1612 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 2px 20px rgba(0,0,0,0.4)',
      }}
    >
      <ImagePlaceholder title={title} />

      <div className="px-4 py-4 space-y-3.5">
        {/* Title — no buy-in badge */}
        <h3 className="text-white font-700 text-[15px] tracking-wide leading-tight uppercase">
          {title}
        </h3>

        {/* Date row: gold weekday + muted rest + time */}
        <div className="flex items-center gap-2 text-[12px] font-500 flex-wrap">
          <span style={{ color: '#D99962' }}>{weekdayCap}</span>
          <span style={{ color: '#A39B98' }}>, {dayMonth}</span>
          <span className="opacity-30 text-white">·</span>
          <Clock size={12} style={{ color: '#c8a38e' }} />
          <span style={{ color: '#A39B98' }}>{startTime}</span>
        </div>

        {/* Seats + progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12px] font-500">
            <span className="flex items-center gap-1.5" style={{ color: '#A39B98' }}>
              <Users size={12} style={{ color: '#c8a38e' }} />
              {isFull ? (
                <span className="text-red-400 font-600">Мест нет</span>
              ) : (
                <span>
                  Осталось:{' '}
                  <span className="text-white font-700">{seatsLeft}</span>
                  <span style={{ color: '#6B6360' }}> / {totalSeats}</span>
                </span>
              )}
            </span>
            <span className="font-700" style={{ color: fillPercent >= 80 ? '#ef4444' : '#F2D8A7' }}>
              {fillPercent}%
            </span>
          </div>

          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#514f4c' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${fillPercent}%`,
                background: fillPercent >= 80
                  ? 'linear-gradient(90deg, #D99962, #ef4444)'
                  : 'linear-gradient(90deg, #8C4C27, #c8a38e)',
              }}
            />
          </div>
        </div>

        {status === 'finished' && (
          <span
            className="inline-block text-[11px] font-500 px-2.5 py-1 rounded-full"
            style={{ color: '#6B6360', background: 'rgba(255,255,255,0.05)' }}
          >
            Завершён
          </span>
        )}
      </div>
    </button>
  );
}
