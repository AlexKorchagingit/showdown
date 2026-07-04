import { useState } from 'react';
import { ArrowLeft, Calendar, Clock, CheckCircle2, XCircle, Star } from 'lucide-react';
import type { Tournament } from '../types/tournament';
import { ProgressBar } from '../components/ProgressBar';
import { useTournaments } from '../context/TournamentContext';

interface Props {
  tournament: Tournament;
  onBack: () => void;
}

const SUIT_ICONS = ['♠', '♥', '♦', '♣', '♠', '♥'];

function HeroImage({ title }: { title: string }) {
  return (
    <div
      className="relative w-full h-52 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #8C4C27 0%, #400904 55%, #0D0000 100%)' }}
    >
      {SUIT_ICONS.map((s, i) => (
        <span
          key={i}
          className="absolute select-none"
          style={{
            color: '#F2D8A7',
            opacity: 0.07,
            fontSize: `${60 + i * 20}px`,
            top:  `${[-10, 30, 55, 10, 40, -5][i]}%`,
            left: `${[5, 55, 20, 75, 40, 85][i]}%`,
            transform: `rotate(${[-20, 15, -10, 25, -5, 12][i]}deg)`,
          }}
        >
          {s}
        </span>
      ))}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <span style={{ color: '#D99962', fontSize: '4rem', opacity: 0.45 }}>♠</span>
        <h2 className="text-white text-lg font-black tracking-[0.25em] uppercase px-4 text-center leading-tight">
          {title}
        </h2>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-16"
        style={{ background: 'linear-gradient(to top, #0D0000, transparent)' }}
      />
    </div>
  );
}

export function TournamentDetailPage({ tournament, onBack }: Props) {
  const { isRegistered, toggleRegistration, tournaments } = useTournaments();
  const [leaving, setLeaving] = useState(false);

  const live       = tournaments.find((t) => t.id === tournament.id) ?? tournament;
  const registered = isRegistered(live.id);

  const formattedDate = new Date(live.startDate).toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const handleBack = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => onBack(), 800);
  };

  return (
    <>
      {/* Fade overlay */}
      <div
        className="fixed inset-0 z-[70] bg-black pointer-events-none transition-opacity duration-300"
        style={{ opacity: leaving ? 1 : 0, transitionDelay: leaving ? '500ms' : '0ms' }}
      />

      <div
        className="fixed inset-0 z-[60] flex flex-col"
        style={{
          background: '#0D0000',
          opacity: leaving ? 0 : 1,
          transition: leaving ? 'opacity 300ms ease 500ms' : 'none',
        }}
      >
        {/* Hero + back button */}
        <div className="relative flex-shrink-0">
          <HeroImage title={live.title} />
          <button
            onClick={handleBack}
            disabled={leaving}
            className="absolute top-4 left-4 w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #dc2626, #991b1b)',
              boxShadow: '0 0 18px rgba(220,38,38,0.55)',
              animation: leaving ? 'spin-once 500ms cubic-bezier(0.4,0,0.2,1) forwards' : 'none',
            }}
          >
            <ArrowLeft size={26} strokeWidth={2.5} className="text-white" />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 scrollable"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
        >
          <div className="px-4 pt-4 space-y-5">
            {/* Title + date */}
            <div className="space-y-2">
              <h1 className="text-white text-2xl font-black tracking-wide">{live.title}</h1>
              <div className="flex items-center gap-4 text-sm" style={{ color: '#D99962' }}>
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} style={{ color: '#F2D8A7' }} />
                  <span className="capitalize">{formattedDate}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} style={{ color: '#F2D8A7' }} />
                  {live.startTime}
                </span>
              </div>
            </div>

            {/* Progress */}
            <div
              className="rounded-2xl p-4"
              style={{
                background: '#400904',
                border: '1px solid rgba(217,153,98,0.2)',
              }}
            >
              <ProgressBar value={live.registeredSeats} max={live.totalSeats} />
            </div>

            {/* Guarantee badge */}
            <div className="relative rounded-2xl overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(135deg, #8C4C27, #D99962)',
                  opacity: 0.18,
                }}
              />
              <div
                className="relative flex items-center gap-3 px-4 py-4 rounded-2xl"
                style={{ border: '1px solid rgba(242,216,167,0.5)' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #8C4C27, #F2D8A7)' }}
                >
                  <Star size={20} fill="currentColor" style={{ color: '#0D0000' }} />
                </div>
                <div>
                  <p
                    className="text-xs uppercase tracking-wider"
                    style={{ color: '#D99962' }}
                  >
                    Гарантия очков
                  </p>
                  <p className="text-white font-black text-2xl tracking-wide">
                    {live.guarantee.toLocaleString('ru-RU')}
                  </p>
                </div>
              </div>
            </div>

            {/* Info block */}
            <div
              className="rounded-2xl p-5 space-y-4"
              style={{
                background: '#400904',
                border: '1px solid rgba(140,76,39,0.3)',
              }}
            >
              <section>
                <h3
                  className="font-bold text-base mb-2 uppercase tracking-wider"
                  style={{ color: '#F2D8A7' }}
                >
                  О турнире
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#D99962' }}>
                  {live.description}
                </p>
              </section>

              <div style={{ height: 1, background: 'rgba(140,76,39,0.3)' }} />

              <section>
                <h3
                  className="font-bold text-base mb-3 uppercase tracking-wider"
                  style={{ color: '#F2D8A7' }}
                >
                  Особенности
                </h3>
                <ul className="space-y-2">
                  {live.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm"
                      style={{ color: '#D99962' }}
                    >
                      <span className="mt-0.5 shrink-0" style={{ color: '#8C4C27' }}>•</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </section>

              <div style={{ height: 1, background: 'rgba(140,76,39,0.3)' }} />

              <section>
                <h3
                  className="font-bold text-base mb-2 uppercase tracking-wider"
                  style={{ color: '#F2D8A7' }}
                >
                  Запись на турниры
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#D99962' }}>
                  Если вы записались, но не можете прийти — пожалуйста, отмените запись заранее,
                  чтобы не занимать место.
                </p>
              </section>
            </div>
          </div>
        </div>

        {/* Sticky CTA */}
        <div
          className="absolute bottom-0 left-0 right-0 px-4 pt-4"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
            background: 'linear-gradient(to top, #0D0000 70%, transparent)',
          }}
        >
          <button
            onClick={() => toggleRegistration(live.id)}
            className="w-full h-14 rounded-2xl font-bold text-base tracking-wide flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.97]"
            style={
              registered
                ? {
                    background: 'rgba(64,9,4,0.8)',
                    border: '2px solid rgba(239,68,68,0.45)',
                    color: '#f87171',
                  }
                : {
                    background: 'linear-gradient(135deg, #8C4C27, #D99962)',
                    color: '#0D0000',
                    boxShadow: '0 0 24px rgba(217,153,98,0.45)',
                  }
            }
          >
            {registered ? (
              <>
                <XCircle size={20} />
                Отменить запись
              </>
            ) : (
              <>
                <CheckCircle2 size={20} />
                Участвовать
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin-once {
          0%   { transform: rotate(0deg)   scale(1);    }
          40%  { transform: rotate(200deg) scale(1.15); }
          70%  { transform: rotate(340deg) scale(0.95); }
          100% { transform: rotate(360deg) scale(1);    }
        }
      `}</style>
    </>
  );
}
