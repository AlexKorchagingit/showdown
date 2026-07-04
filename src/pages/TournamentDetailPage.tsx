import { ArrowLeft, Calendar, Clock, CheckCircle2, XCircle, Star } from 'lucide-react';
import type { Tournament } from '../types/tournament';
import { ProgressBar } from '../components/ProgressBar';
import { useTournaments } from '../context/TournamentContext';

interface Props {
  tournament: Tournament;
  onBack: () => void;
}

// All mock participants — shown without slicing
const ALL_PARTICIPANTS = [
  { id: '1',  nickname: 'Alex_King',     rating: 4200 },
  { id: '2',  nickname: 'DmitriyVP',     rating: 3850 },
  { id: '3',  nickname: 'MikhailS',      rating: 3610 },
  { id: '4',  nickname: 'AndreyPP',      rating: 2980 },
  { id: '5',  nickname: 'SergeyN',       rating: 2740 },
  { id: '6',  nickname: 'IvanKuznetsov', rating: 2510 },
  { id: '7',  nickname: 'OlegMaster',    rating: 2380 },
  { id: '8',  nickname: 'ArtemVolkov',   rating: 2150 },
  { id: '9',  nickname: 'NikolaevD',     rating: 1970 },
  { id: '10', nickname: 'PavelCar',      rating: 1810 },
  { id: '11', nickname: 'VasilyK',       rating: 1650 },
  { id: '12', nickname: 'RomanZ',        rating: 1540 },
  { id: '13', nickname: 'TimurB',        rating: 1420 },
  { id: '14', nickname: 'KirillM',       rating: 1310 },
  { id: '15', nickname: 'AlinaP',        rating: 1200 },
  { id: '16', nickname: 'StasR',         rating: 1080 },
  { id: '17', nickname: 'YuriF',         rating:  970 },
  { id: '18', nickname: 'NataV',         rating:  860 },
  { id: '19', nickname: 'GlebS',         rating:  750 },
  { id: '20', nickname: 'MaximN',        rating:  640 },
];

const SUIT_ICONS = ['♠', '♥', '♦', '♣', '♠', '♥'];

function HeroImage({ title }: { title: string }) {
  return (
    <div className="relative w-full h-52 overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #3a2015 0%, #2A211D 55%, #0A0908 100%)' }}>
      {SUIT_ICONS.map((s, i) => (
        <span key={i} className="absolute select-none"
          style={{ color: '#F2D8A7', opacity: 0.055,
            fontSize: `${60 + i * 20}px`,
            top:  `${[-10, 30, 55, 10, 40, -5][i]}%`,
            left: `${[5, 55, 20, 75, 40, 85][i]}%`,
            transform: `rotate(${[-20, 15, -10, 25, -5, 12][i]}deg)` }}>
          {s}
        </span>
      ))}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <span style={{ color: '#D99962', fontSize: '3.8rem', opacity: 0.38 }}>♠</span>
        <h2 className="text-white text-[17px] font-900 uppercase tracking-[0.25em] px-6 text-center leading-tight">
          {title}
        </h2>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-16"
           style={{ background: 'linear-gradient(to top, #0A0908, transparent)' }} />
    </div>
  );
}

export function TournamentDetailPage({ tournament, onBack }: Props) {
  const { isRegistered, toggleRegistration, tournaments } = useTournaments();

  const live       = tournaments.find((t) => t.id === tournament.id) ?? tournament;
  const registered = isRegistered(live.id);

  const formattedDate = new Date(live.startDate).toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // Show participants up to registeredSeats count (no slice limit)
  const participants = ALL_PARTICIPANTS.filter((_, i) => i < live.registeredSeats);

  return (
    <>
      <div className="fixed inset-0 z-[60] flex flex-col bg-obsidian">
        {/* Hero */}
        <div className="relative flex-shrink-0">
          <HeroImage title={live.title} />

          {/* Back button — instant, no animation */}
          <button
            onClick={onBack}
            className="absolute top-4 left-4 w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(28,20,16,0.78)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(217,153,98,0.28)',
            }}
          >
            <ArrowLeft size={22} strokeWidth={2.2} style={{ color: '#D99962' }} />
          </button>
        </div>

        {/* Content */}
        <div
          className="flex-1 scrollable"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
        >
          <div className="px-5 pt-5 space-y-5">
            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-white text-[22px] font-900 uppercase tracking-wider leading-tight">
                {live.title}
              </h1>
              <div className="flex items-center gap-4 text-[12px] font-500" style={{ color: '#A39B98' }}>
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: '#c8a38e' }} />
                  <span className="capitalize">{formattedDate}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={13} style={{ color: '#c8a38e' }} />
                  {live.startTime}
                </span>
              </div>
            </div>

            {/* Progress — tick-free */}
            <div className="rounded-2xl p-4"
                 style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}>
              <ProgressBar value={live.registeredSeats} max={live.totalSeats} />
            </div>

            {/* Guarantee */}
            <div className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 opacity-[0.12]"
                   style={{ background: 'linear-gradient(to right, #D99962, #F2D8A7)' }} />
              <div className="relative flex items-center gap-4 px-5 py-4 rounded-2xl"
                   style={{ border: '1px solid rgba(242,216,167,0.32)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                     style={{ background: 'linear-gradient(to right, #D99962, #F2D8A7)' }}>
                  <Star size={20} fill="currentColor" style={{ color: '#0A0908' }} />
                </div>
                <div>
                  <p className="text-[11px] font-600 uppercase tracking-[0.12em]" style={{ color: '#A39B98' }}>
                    Гарантия очков
                  </p>
                  <p className="text-white font-900 text-[24px] tracking-wide leading-tight">
                    {live.guarantee.toLocaleString('ru-RU')}
                  </p>
                </div>
              </div>
            </div>

            {/* Info block */}
            <div className="rounded-2xl p-5 space-y-5"
                 style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.05)' }}>
              <section>
                <h3 className="text-[12px] font-700 uppercase tracking-[0.2em] mb-3" style={{ color: '#F2D8A7' }}>
                  О турнире
                </h3>
                <p className="text-[13px] font-400 leading-relaxed" style={{ color: '#A39B98' }}>
                  {live.description}
                </p>
              </section>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <section>
                <h3 className="text-[12px] font-700 uppercase tracking-[0.2em] mb-3" style={{ color: '#F2D8A7' }}>
                  Особенности
                </h3>
                <ul className="space-y-2">
                  {live.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px] font-400" style={{ color: '#A39B98' }}>
                      <span style={{ color: '#8C4C27', marginTop: 2 }}>•</span>{f}
                    </li>
                  ))}
                </ul>
              </section>
              {/* "Запись" section — hidden for past tournaments */}
              {live.status !== 'finished' && (
                <>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                  <section>
                    <h3 className="text-[12px] font-700 uppercase tracking-[0.2em] mb-3" style={{ color: '#F2D8A7' }}>
                      Запись
                    </h3>
                    <p className="text-[13px] font-400 leading-relaxed" style={{ color: '#A39B98' }}>
                      Если вы записались, но не можете прийти — отмените запись заранее, чтобы не занимать место.
                    </p>
                  </section>
                </>
              )}
            </div>

            {/* ─── УЧАСТНИКИ ─── */}
            <div className="rounded-2xl overflow-hidden"
                 style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.05)' }}>
              {/* Header: left = "Участники (20/36)", right = "Рейтинг сезона" */}
              <div className="flex items-center justify-between px-5 py-4"
                   style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 className="text-[12px] font-700 uppercase tracking-[0.2em]" style={{ color: '#F2D8A7' }}>
                  Участники ({live.registeredSeats}/{live.totalSeats})
                </h3>
                <span className="text-[12px] font-600" style={{ color: '#D99962' }}>
                  Рейтинг сезона
                </span>
              </div>

              {/* All participants — no slice */}
              {participants.length === 0 ? (
                <p className="px-5 py-4 text-[13px] font-500" style={{ color: '#6B6360' }}>
                  Пока никто не зарегистрировался
                </p>
              ) : (
                <div>
                  {participants.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3.5 px-5 py-3"
                      style={{ borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                    >
                      <span className="text-[11px] font-700 w-5 text-right shrink-0" style={{ color: '#6B6360' }}>
                        {idx + 1}
                      </span>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-700 shrink-0"
                           style={{ background: 'rgba(140,76,39,0.22)', color: '#c8a38e' }}>
                        {p.nickname[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-[13px] font-600 truncate">{p.nickname}</p>
                      </div>
                      <p className="text-[12px] font-700 shrink-0" style={{ color: '#D99962' }}>
                        {p.rating.toLocaleString('ru-RU')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky CTA */}
        <div
          className="absolute bottom-0 left-0 right-0 px-5 pt-4"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
            background: 'linear-gradient(to top, #0A0908 65%, transparent)',
          }}
        >
          {live.status === 'finished' ? (
            /* Finished tournament — solid filled gray, no opacity tricks */
            <button
              disabled
              className="w-full h-14 rounded-2xl font-700 text-[14px] tracking-wide flex items-center justify-center gap-2.5 cursor-not-allowed"
              style={{ background: '#514f4c', color: '#ffffff' }}
            >
              Турнир завершился
            </button>
          ) : registered ? (
            <button
              onClick={() => toggleRegistration(live.id)}
              className="w-full h-14 rounded-2xl font-700 text-[15px] tracking-wide flex items-center justify-center gap-2.5 active:scale-[0.97] transition-transform"
              style={{ background: 'rgba(42,33,29,0.9)', border: '1.5px solid rgba(239,68,68,0.38)', color: '#f87171' }}
            >
              <XCircle size={19} />Отменить запись
            </button>
          ) : (
            <button
              onClick={() => toggleRegistration(live.id)}
              className="w-full h-14 rounded-2xl font-700 text-[15px] tracking-wide flex items-center justify-center gap-2.5 active:scale-[0.97] transition-transform"
              style={{
                background: 'linear-gradient(to right, #8C4C27, #D99962)',
                color: '#0A0908',
                boxShadow: '0 0 24px rgba(217,153,98,0.32)',
              }}
            >
              <CheckCircle2 size={19} />Участвовать
            </button>
          )}
        </div>
      </div>
    </>
  );
}
