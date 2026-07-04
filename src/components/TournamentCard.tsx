import { Calendar, Clock, Users } from 'lucide-react';
import type { Tournament } from '../types/tournament';

interface Props {
  tournament: Tournament;
  onClick: (tournament: Tournament) => void;
}

const SUIT_ICONS = ['♠', '♥', '♦', '♣'];

function TournamentImagePlaceholder({ title }: { title: string }) {
  return (
    <div
      className="relative w-full h-36 rounded-xl overflow-hidden flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #5a1c0c 0%, #8C4C27 50%, #5a1c0c 100%)' }}
    >
      <div className="absolute inset-0 opacity-[0.12]">
        {SUIT_ICONS.map((s, i) => (
          <span
            key={i}
            className="absolute select-none"
            style={{
              color: '#F2D8A7',
              fontSize: `${24 + (i % 3) * 12}px`,
              top:  `${[10, 50, 20, 60][i]}%`,
              left: `${[10, 70, 40, 25][i]}%`,
              transform: `rotate(${[-15, 20, -5, 10][i]}deg)`,
            }}
          >
            {s}
          </span>
        ))}
      </div>
      <div className="relative z-10 text-center px-4">
        <div className="text-4xl mb-1" style={{ color: '#D99962', opacity: 0.45 }}>♠</div>
        <p className="text-white font-bold text-sm tracking-widest uppercase opacity-80 leading-tight">
          {title}
        </p>
      </div>
    </div>
  );
}

export function TournamentCard({ tournament, onClick }: Props) {
  const { title, startDate, startTime, totalSeats, registeredSeats, buyIn, status } = tournament;

  const seatsLeft   = totalSeats - registeredSeats;
  const isFull      = seatsLeft === 0;
  const fillPercent = Math.round((registeredSeats / totalSeats) * 100);

  const formattedDate = new Date(startDate).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long',
  });

  return (
    <button
      onClick={() => onClick(tournament)}
      className="w-full text-left rounded-2xl overflow-hidden shadow-card active:scale-[0.98] transition-transform duration-150"
      style={{
        background: 'linear-gradient(180deg, #5a1c0c 0%, #4c180b 100%)',
        border: '1px solid rgba(217,153,98,0.18)',
      }}
    >
      <TournamentImagePlaceholder title={title} />

      <div className="p-4 space-y-3">
        {/* Title + buy-in */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-white font-bold text-base tracking-wide leading-tight">{title}</h3>
          <span
            className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap"
            style={{
              background: 'linear-gradient(135deg, #8C4C27, #D99962)',
              color: '#1d0b07',
            }}
          >
            {buyIn.toLocaleString('ru-RU')} ₽
          </span>
        </div>

        {/* Date + time */}
        <div className="flex items-center gap-4 text-xs" style={{ color: '#D99962' }}>
          <span className="flex items-center gap-1.5">
            <Calendar size={13} />
            {formattedDate}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={13} />
            {startTime}
          </span>
        </div>

        {/* Seats + progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5" style={{ color: '#D99962' }}>
              <Users size={13} />
              {isFull ? (
                <span className="text-red-400 font-medium">Мест нет</span>
              ) : (
                <span>
                  Осталось мест:{' '}
                  <span className="text-white font-semibold">{seatsLeft}</span>
                  {' '}из {totalSeats}
                </span>
              )}
            </span>
            <span
              className="font-medium"
              style={{ color: fillPercent >= 80 ? '#ef4444' : '#F2D8A7' }}
            >
              {fillPercent}%
            </span>
          </div>

          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: 'rgba(140,76,39,0.35)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${fillPercent}%`,
                background: fillPercent >= 80
                  ? 'linear-gradient(90deg, #D99962, #ef4444)'
                  : 'linear-gradient(90deg, #8C4C27, #F2D8A7)',
              }}
            />
          </div>
        </div>

        {status === 'finished' && (
          <div className="flex items-center gap-2 pt-1">
            <span
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ color: '#8C4C27', background: 'rgba(140,76,39,0.2)' }}
            >
              Завершён
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
