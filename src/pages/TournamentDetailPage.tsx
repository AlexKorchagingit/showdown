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

// Hero block (inside scroll) — rounded, with date/time, no back button
function LobbyHero({
  title,
  formattedDate,
  startTime,
}: {
  title: string;
  formattedDate: string;
  startTime: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl mx-4 mt-4"
      style={{ height: 240, background: '#1d0b07' }}
    >
      {/* Background fishka */}
      <img
        src="/fishka.svg"
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

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(to right, #1d0b07 0%, rgba(29,11,7,0.6) 55%, transparent 100%)',
        }}
      />

      {/* Title + date/time — bottom-left */}
      <div className="absolute bottom-5 left-6 z-20" style={{ width: '72%' }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#D99962' }}>
          Лобби турнира
        </p>
        <h1
          className="text-2xl font-black text-white uppercase leading-tight mb-2"
          style={{ letterSpacing: '0.04em' }}
        >
          {title}
        </h1>
        {/* Date + time inside hero */}
        <div className="flex items-center gap-2 text-[12px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
          <Calendar size={12} style={{ color: '#c8a38e' }} />
          <span className="capitalize">{formattedDate}</span>
          <span className="opacity-30">·</span>
          <Clock size={12} style={{ color: '#c8a38e' }} />
          {startTime}
        </div>
      </div>
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
      <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">

        {/* ── Back button: fixed on outer layer, never scrolls ── */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 z-50 w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(28,20,16,0.78)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(217,153,98,0.28)',
          }}
        >
          <ArrowLeft size={22} strokeWidth={2.2} style={{ color: '#D99962' }} />
        </button>

        {/* ── Scrollable: hero + all content ── */}
        <div
          className="flex-1 scrollable"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
        >
          {/* Hero inside scroll — rounded corners, date/time baked in */}
          <LobbyHero
            title={live.title}
            formattedDate={formattedDate}
            startTime={live.startTime}
          />

          <div className="px-5 pt-4 space-y-5">
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

              {/* Participant rows */}
              {participants.length === 0 ? (
                <p className="px-5 py-4 text-[13px] font-500" style={{ color: '#6B6360' }}>
                  Пока никто не зарегистрировался
                </p>
              ) : (
                <div>
                  {participants.map((p, idx) => {
                    const isFinished   = live.status === 'finished';
                    const isPodium     = isFinished && idx < 3;   // top-3: wreath + gradient
                    const isFinalTable = isFinished && idx < 9;   // 1-9: gold gradient text
                    const wreathColor  = ['#D99962', '#8c8c88', '#8C4C27'][idx] ?? null;

                    return (
                      <div key={p.id}>
                        {/* "Финальный стол" header + thick top border */}
                        {isFinished && idx === 0 && (
                          <>
                            <div className="px-5 pt-3 pb-1 text-[10px] font-700 uppercase tracking-[0.15em]"
                                 style={{ color: '#D99962' }}>
                              🏆 Финальный стол
                            </div>
                            {/* Thick gold border above final table */}
                            <div style={{ height: 2, background: 'rgba(217,153,98,0.35)', margin: '0 16px 4px' }} />
                          </>
                        )}

                        {/* Thick border AFTER 9th place */}
                        {isFinished && idx === 8 && participants.length > 9 && (
                          <div>
                            {/* Row rendered below, then border after */}
                          </div>
                        )}

                        {/* Row */}
                        <div
                          className="flex items-center gap-3.5 px-5 py-3"
                          style={{
                            borderTop: idx > 0 && !(isFinished && idx === 0)
                              ? '1px solid rgba(255,255,255,0.05)'
                              : 'none',
                          }}
                        >
                          {/* Rank */}
                          <span
                            className="text-[11px] font-700 w-5 text-right shrink-0"
                            style={{ color: isFinalTable ? '#D99962' : '#ffffff' }}
                          >
                            {idx + 1}
                          </span>

                          {/* Avatar — wreath for top-3 */}
                          <div className="relative shrink-0">
                            {isPodium && (
                              <div
                                className="absolute rounded-full pointer-events-none animate-pulse"
                                style={{
                                  inset: '-3px',
                                  border: `2px solid ${wreathColor}`,
                                  boxShadow: `0 0 8px ${wreathColor}`,
                                }}
                              />
                            )}
                            <div
                              className="relative w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-700 z-10"
                              style={{
                                background: isFinalTable
                                  ? 'rgba(140,76,39,0.28)'
                                  : 'rgba(255,255,255,0.08)',
                                color: isFinalTable ? '#c8a38e' : '#A39B98',
                              }}
                            >
                              {p.nickname[0].toUpperCase()}
                            </div>
                          </div>

                          {/* Nickname */}
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-[13px] font-600 truncate"
                              style={
                                isFinalTable
                                  ? {
                                      background: 'linear-gradient(to right, #D99962, #F2D8A7)',
                                      WebkitBackgroundClip: 'text',
                                      WebkitTextFillColor: 'transparent',
                                      backgroundClip: 'text',
                                    }
                                  : { color: '#ffffff' }   /* places 10+: white */
                              }
                            >
                              {p.nickname}
                            </p>
                          </div>

                          {/* Rating */}
                          <p
                            className="text-[12px] font-700 shrink-0"
                            style={{ color: isFinalTable ? '#D99962' : '#ffffff' }}
                          >
                            {p.rating.toLocaleString('ru-RU')}
                          </p>
                        </div>

                        {/* Thick gold border AFTER 9th place */}
                        {isFinished && idx === 8 && participants.length > 9 && (
                          <div style={{ height: 2, background: 'rgba(217,153,98,0.35)', margin: '4px 16px' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>{/* end scrollable */}

        {/* ── CTA: fixed at bottom, transparent wrapper ── */}
        <div
          className="fixed bottom-4 left-0 right-0 px-4 z-50 bg-transparent pointer-events-none"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {live.status === 'finished' ? (
            /* Finished — 100% opaque solid fill, disabled:opacity-100 overrides Tailwind default */
            <button
              disabled
              className="pointer-events-auto w-full h-14 rounded-2xl font-700 text-[14px] tracking-wide flex items-center justify-center gap-2.5 cursor-not-allowed disabled:opacity-100"
              style={{ background: '#514f4c', color: 'rgba(255,255,255,0.5)', opacity: 1 }}
            >
              Турнир завершился
            </button>
          ) : registered ? (
            <button
              onClick={() => toggleRegistration(live.id)}
              className="pointer-events-auto w-full h-14 rounded-2xl font-700 text-[15px] tracking-wide flex items-center justify-center gap-2.5 active:scale-[0.97] transition-transform"
              style={{ background: 'rgba(42,33,29,0.9)', border: '1.5px solid rgba(239,68,68,0.38)', color: '#f87171' }}
            >
              <XCircle size={19} />Отменить запись
            </button>
          ) : (
            <button
              onClick={() => toggleRegistration(live.id)}
              className="pointer-events-auto w-full h-14 rounded-2xl font-700 text-[15px] tracking-wide flex items-center justify-center gap-2.5 active:scale-[0.97] transition-transform"
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
