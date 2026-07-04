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
    <div className="relative w-full h-52 bg-gradient-to-br from-[#1E1A0E] via-[#2A2010] to-[#0A0A0A] overflow-hidden">
      {SUIT_ICONS.map((s, i) => (
        <span
          key={i}
          className="absolute select-none text-[#D4AF37] opacity-[0.07]"
          style={{
            fontSize: `${60 + i * 20}px`,
            top: `${[-10, 30, 55, 10, 40, -5][i]}%`,
            left: `${[5, 55, 20, 75, 40, 85][i]}%`,
            transform: `rotate(${[-20, 15, -10, 25, -5, 12][i]}deg)`,
          }}
        >
          {s}
        </span>
      ))}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <span className="text-[#D4AF37] text-6xl opacity-50">♠</span>
        <h2 className="text-white text-lg font-black tracking-[0.25em] uppercase px-4 text-center leading-tight">
          {title}
        </h2>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0A0A0A] to-transparent" />
    </div>
  );
}

export function TournamentDetailPage({ tournament, onBack }: Props) {
  const { isRegistered, toggleRegistration, tournaments } = useTournaments();
  const [leaving, setLeaving] = useState(false);

  const live = tournaments.find((t) => t.id === tournament.id) ?? tournament;
  const registered = isRegistered(live.id);

  const formattedDate = new Date(live.startDate).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const handleBack = () => {
    if (leaving) return;
    setLeaving(true);
    // Spin runs for 500ms, then fade-to-black for 300ms, then unmount
    setTimeout(() => onBack(), 800);
  };

  return (
    <>
      {/* Full-screen fade overlay — appears after spin completes */}
      <div
        className="fixed inset-0 z-[70] bg-black pointer-events-none transition-opacity duration-300"
        style={{ opacity: leaving ? 1 : 0, transitionDelay: leaving ? '500ms' : '0ms' }}
      />

      <div
        className="fixed inset-0 z-[60] bg-[#0A0A0A] flex flex-col"
        style={{
          opacity: leaving ? 0 : 1,
          transition: leaving ? 'opacity 300ms ease 500ms' : 'none',
        }}
      >
        {/* Back button overlay on top of hero */}
        <div className="relative flex-shrink-0">
          <HeroImage title={live.title} />

          <button
            onClick={handleBack}
            disabled={leaving}
            className="absolute top-4 left-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #dc2626, #991b1b)',
              boxShadow: '0 0 18px rgba(220,38,38,0.55)',
              animation: leaving ? 'spin-once 500ms cubic-bezier(0.4,0,0.2,1) forwards' : 'none',
            }}
          >
            <ArrowLeft
              size={26}
              strokeWidth={2.5}
              className="text-white"
              style={{
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
              }}
            />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 scrollable"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
        >
          <div className="px-4 pt-4 space-y-5">
            {/* Title + date/time */}
            <div className="space-y-2">
              <h1 className="text-white text-2xl font-black tracking-wide">{live.title}</h1>
              <div className="flex items-center gap-4 text-[#A3A3A3] text-sm">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-[#D4AF37]" />
                  <span className="capitalize">{formattedDate}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-[#D4AF37]" />
                  {live.startTime}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="rounded-2xl bg-[#1A1A1A] border border-[rgba(212,175,55,0.15)] p-4">
              <ProgressBar value={live.registeredSeats} max={live.totalSeats} />
            </div>

            {/* Guarantee badge */}
            <div className="relative rounded-2xl overflow-hidden">
              <div
                className="absolute inset-0 opacity-20"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #FFD700, #A8860C)' }}
              />
              <div
                className="relative flex items-center gap-3 px-4 py-4 border rounded-2xl"
                style={{ borderColor: 'rgba(212,175,55,0.5)' }}
              >
                <div className="w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center shrink-0">
                  <Star size={20} className="text-[#0A0A0A]" fill="currentColor" />
                </div>
                <div>
                  <p className="text-[#A3A3A3] text-xs uppercase tracking-wider">Гарантия очков</p>
                  <p className="text-white font-black text-2xl tracking-wide">
                    {live.guarantee.toLocaleString('ru-RU')}
                  </p>
                </div>
              </div>
            </div>

            {/* About block */}
            <div className="rounded-2xl bg-[#1A1A1A] border border-[rgba(255,255,255,0.06)] p-5 space-y-4">
              <section>
                <h3 className="text-[#D4AF37] font-bold text-base mb-2 uppercase tracking-wider">
                  О турнире
                </h3>
                <p className="text-[#C0C0C0] text-sm leading-relaxed">{live.description}</p>
              </section>

              <div className="h-px bg-[rgba(255,255,255,0.06)]" />

              <section>
                <h3 className="text-[#D4AF37] font-bold text-base mb-3 uppercase tracking-wider">
                  Особенности
                </h3>
                <ul className="space-y-2">
                  {live.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-[#C0C0C0]">
                      <span className="text-[#D4AF37] mt-0.5 shrink-0">•</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </section>

              <div className="h-px bg-[rgba(255,255,255,0.06)]" />

              <section>
                <h3 className="text-[#D4AF37] font-bold text-base mb-2 uppercase tracking-wider">
                  Запись на турниры
                </h3>
                <p className="text-[#C0C0C0] text-sm leading-relaxed">
                  Если вы записались, но не можете прийти — пожалуйста, отмените запись заранее,
                  чтобы не занимать место.
                </p>
              </section>
            </div>
          </div>
        </div>

        {/* Sticky CTA button */}
        <div
          className="absolute bottom-0 left-0 right-0 px-4 pt-3 pb-3 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          <button
            onClick={() => toggleRegistration(live.id)}
            className={`w-full h-14 rounded-2xl font-bold text-base tracking-wide flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.97] ${
              registered
                ? 'bg-[#2A1A1A] border-2 border-red-500/50 text-red-400'
                : 'bg-gold-gradient text-[#0A0A0A] shadow-gold'
            }`}
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

      {/* Keyframe for back-button spin */}
      <style>{`
        @keyframes spin-once {
          0%   { transform: rotate(0deg) scale(1); }
          40%  { transform: rotate(200deg) scale(1.15); }
          70%  { transform: rotate(340deg) scale(0.95); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>
    </>
  );
}
