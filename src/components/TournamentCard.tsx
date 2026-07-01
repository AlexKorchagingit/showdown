import { Calendar, Clock, Users } from 'lucide-react';
import type { Tournament } from '../types/tournament';

interface Props {
  tournament: Tournament;
  onClick: (tournament: Tournament) => void;
}

const SUIT_ICONS = ['♠', '♥', '♦', '♣'];

function TournamentImagePlaceholder({ title }: { title: string }) {
  return (
    <div className="relative w-full h-36 rounded-xl overflow-hidden bg-gradient-to-br from-[#1E1A0E] via-[#2A2010] to-[#1A1A1A] flex items-center justify-center">
      <div className="absolute inset-0 opacity-10">
        {SUIT_ICONS.map((s, i) => (
          <span
            key={i}
            className="absolute text-[#D4AF37] select-none"
            style={{
              fontSize: `${24 + (i % 3) * 12}px`,
              top: `${[10, 50, 20, 60][i]}%`,
              left: `${[10, 70, 40, 25][i]}%`,
              transform: `rotate(${[-15, 20, -5, 10][i]}deg)`,
            }}
          >
            {s}
          </span>
        ))}
      </div>
      <div className="relative z-10 text-center px-4">
        <div className="text-[#D4AF37] text-4xl mb-1 opacity-40">♠</div>
        <p className="text-white font-bold text-sm tracking-widest uppercase opacity-70 leading-tight">
          {title}
        </p>
      </div>
    </div>
  );
}

export function TournamentCard({ tournament, onClick }: Props) {
  const { title, startDate, startTime, totalSeats, registeredSeats, buyIn, status } = tournament;

  const seatsLeft = totalSeats - registeredSeats;
  const isFull = seatsLeft === 0;
  const fillPercent = Math.round((registeredSeats / totalSeats) * 100);

  const formattedDate = new Date(startDate).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });

  return (
    <button
      onClick={() => onClick(tournament)}
      className="w-full text-left rounded-2xl bg-card-gradient border border-[rgba(212,175,55,0.15)] overflow-hidden shadow-card active:scale-[0.98] transition-transform duration-150"
    >
      <TournamentImagePlaceholder title={title} />

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-white font-bold text-base tracking-wide leading-tight">{title}</h3>
          <span className="shrink-0 text-xs font-bold text-[#0A0A0A] bg-gold-gradient px-2.5 py-1 rounded-lg whitespace-nowrap">
            {buyIn.toLocaleString('ru-RU')} ₽
          </span>
        </div>

        <div className="flex items-center gap-4 text-[#A3A3A3] text-xs">
          <span className="flex items-center gap-1.5">
            <Calendar size={13} />
            {formattedDate}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={13} />
            {startTime}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-[#A3A3A3]">
              <Users size={13} />
              {isFull ? (
                <span className="text-red-400 font-medium">Мест нет</span>
              ) : (
                <span>
                  Осталось мест:{' '}
                  <span className="text-white font-semibold">
                    {seatsLeft}
                  </span>{' '}
                  из {totalSeats}
                </span>
              )}
            </span>
            <span className={`font-medium ${fillPercent >= 80 ? 'text-red-400' : 'text-[#D4AF37]'}`}>
              {fillPercent}%
            </span>
          </div>

          <div className="h-1.5 bg-[#2E2E2E] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${fillPercent}%`,
                background:
                  fillPercent >= 80
                    ? 'linear-gradient(90deg, #D4AF37, #FF6B6B)'
                    : 'linear-gradient(90deg, #A8860C, #FFD700)',
              }}
            />
          </div>
        </div>

        {status === 'finished' && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-[#5A5A5A] bg-[#2E2E2E] px-2.5 py-1 rounded-full">
              Завершён
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
