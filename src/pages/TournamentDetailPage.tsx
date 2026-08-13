import { ArrowLeft, Calendar, Clock, CheckCircle2, XCircle, Star, MapPin } from 'lucide-react';
import type { Tournament } from '../types/tournament';
import { ProgressBar } from '../components/ProgressBar';
import { PlayerNameLink } from '../components/PlayerNameLink';
import { useTournaments } from '../context/TournamentContext';
import { useFinance } from '../context/FinanceContext';
import { useUser } from '../context/UserContext';
import {
  isFinished as hasFinished,
  sortByRating,
  sortByPlace,
  hasMissingPlaces,
} from '../lib/tournamentStatus';
import { ratingPointsForPlace } from '../data/prizeStructure';
import { CLUB_ADDRESS_CITY, CLUB_ADDRESS_STREET } from '../lib/clubAddress';
import { tournamentArtClassName, TOURNAMENT_ART_FADE, TOURNAMENT_ART_MASK } from '../lib/tournamentArt';
import { formatTxDateTime } from '../lib/transactionDisplay';

interface Props {
  tournament: Tournament;
  onBack: () => void;
}

// Hero block (inside scroll) — rounded, with date/time, no back button
function LobbyHero({
  title,
  formattedDate,
  startTime,
  imageUrl,
  tournamentId,
}: {
  title: string;
  formattedDate: string;
  startTime: string;
  imageUrl: string;
  tournamentId: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl mx-4 mt-4 bg-transparent border-0 shadow-none ring-0"
      style={{ height: 200, background: '#1d0b07' }}
    >
      {/* Fully transparent art wrapper — no bg / border / ring / shadow */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-transparent border-0 shadow-none ring-0 outline-none">
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          className={tournamentArtClassName(tournamentId)}
          style={{
            opacity: 0.85,
            filter: 'brightness(1.08) contrast(1.04) saturate(1.04)',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            background: 'transparent',
            ...TOURNAMENT_ART_MASK,
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none border-0 shadow-none ring-0"
          style={TOURNAMENT_ART_FADE}
        />
      </div>

      {/* Title + date/time — bottom-left */}
      <div className="absolute bottom-4 left-5 z-20" style={{ width: '72%' }}>
        <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: '#D99962' }}>
          Лобби турнира
        </p>
        <h1
          className="text-xl font-black text-white uppercase leading-tight mb-1.5"
          style={{ letterSpacing: '0.04em' }}
        >
          {title}
        </h1>
        <div className="flex flex-col gap-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
          <div className="flex items-center gap-2">
            <Calendar size={11} style={{ color: '#c8a38e' }} />
            <span className="capitalize">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={11} style={{ color: '#c8a38e' }} />
            {startTime}
          </div>
        </div>
        <div className="flex items-start gap-2 text-[10px] mt-1" style={{ color: '#8c8c88' }}>
          <MapPin size={10} className="shrink-0 mt-0.5" style={{ color: '#c8a38e' }} />
          <span className="whitespace-normal break-words text-wrap">
            {CLUB_ADDRESS_CITY}
            <br />
            {CLUB_ADDRESS_STREET}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatDealerHours(hours: number, minutes = 0): string {
  if (minutes > 0) return `${hours} ч ${minutes} мин`;
  const whole = Math.floor(hours);
  const mins = Math.round((hours - whole) * 60);
  if (mins === 0) return `${hours} ч`;
  return `${whole} ч ${mins} мин`;
}

export function TournamentDetailPage({ tournament, onBack }: Props) {
  const { isRegistered, toggleRegistration, tournaments } = useTournaments();
  const { getDealerHours } = useFinance();
  const { isAdmin } = useUser();

  const live       = tournaments.find((t) => t.id === tournament.id) ?? tournament;
  const registered = isRegistered(live.id);

  const formattedDate = new Date(live.startDate).toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const tournamentFinished = hasFinished(live);
  const participants = tournamentFinished
    ? sortByPlace(live.participants)
    : sortByRating(live.participants);
  const occupiedSeats = live.participants.length;
  const missingPlaces = tournamentFinished && hasMissingPlaces(live);
  const playingDealers = live.participants
    .map((p) => ({ name: p.nickname, hours: getDealerHours(live.id, p.id) }))
    .filter((row) => row.hours > 0);
  const nonPlayingDealers = (live.dealers ?? []).filter((d) => d.name.trim());
  const hasDealers = playingDealers.length > 0 || nonPlayingDealers.length > 0;

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
            imageUrl={live.imageUrl}
            tournamentId={live.id}
          />

          {missingPlaces && (
            <div
              className="mx-4 mt-3 rounded-xl px-4 py-3 text-[12px] font-800 leading-snug text-center"
              style={{
                background: 'linear-gradient(to right, #7f1d1d, #ef4444)',
                color: '#fff',
                boxShadow: '0 0 18px rgba(239,68,68,0.35)',
              }}
            >
              Внимание: Не всем участникам проставлены места! Результаты не окончательные.
            </div>
          )}

          <div className="px-5 pt-3 space-y-5">
            <div className="space-y-3">
              {/* Guarantee — full width; compact gaps to hero and progress */}
              <div
                className="relative w-full flex items-center gap-3 rounded-xl overflow-hidden px-4 py-1.5"
                style={{ border: '1px solid rgba(242,216,167,0.32)' }}
              >
                <div
                  className="absolute inset-0 opacity-[0.12] pointer-events-none"
                  style={{ background: 'linear-gradient(to right, #D99962, #F2D8A7)' }}
                />
                <div
                  className="relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(to right, #D99962, #F2D8A7)' }}
                >
                  <Star size={15} fill="currentColor" style={{ color: '#0A0908' }} />
                </div>
                <div className="relative">
                  <p className="text-[10px] font-600 uppercase tracking-[0.12em]" style={{ color: '#A39B98' }}>
                    Гарантия очков
                  </p>
                  <p className="text-white font-900 text-base tracking-wide leading-tight">
                    {live.guarantee.toLocaleString('ru-RU')}
                  </p>
                </div>
              </div>

              {/* Progress — tick-free */}
              <div className="rounded-2xl p-4"
                   style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}>
                <ProgressBar value={occupiedSeats} max={live.totalSeats} />
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
                  {live.about}
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
              {!tournamentFinished && (
                <>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                  <section>
                    <h3 className="text-[12px] font-700 uppercase tracking-[0.2em] mb-3" style={{ color: '#F2D8A7' }}>
                      Запись на турнир
                    </h3>
                    <p className="italic text-[#8c8c88] text-sm p-4 bg-[#231A16] rounded-xl leading-relaxed">
                      Если вы записались, но не можете прийти — пожалуйста, отмените запись заранее, чтобы не занимать место.
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
                  Участники ({occupiedSeats}/{live.totalSeats})
                </h3>
                <span className="text-[12px] font-600" style={{ color: '#D99962' }}>
                  {tournamentFinished ? 'Место / очки' : 'Рейтинг сезона'}
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
                    const isClosedRow  = tournamentFinished;
                    const placeNum     = p.place ?? (isClosedRow ? null : idx + 1);
                    const isPodium     = isClosedRow && p.place != null && p.place <= 3;
                    const isFinalTable = isClosedRow && p.place != null && p.place <= 9;
                    const wreathColor  = p.place != null
                      ? ['#D99962', '#8c8c88', '#8C4C27'][p.place - 1] ?? null
                      : null;
                    const award = p.place != null
                      ? ratingPointsForPlace(p.place, live.guarantee)
                      : 0;

                    return (
                      <div key={p.id}>
                        {isClosedRow && idx === 0 && participants.some((row) => (row.place ?? 99) <= 9) && (
                          <>
                            <div className="px-5 pt-3 pb-1 text-[10px] font-700 uppercase tracking-[0.15em]"
                                 style={{ color: '#D99962' }}>
                              🏆 Финальный стол
                            </div>
                            <div style={{ height: 2, background: 'rgba(217,153,98,0.35)', margin: '0 16px 4px' }} />
                          </>
                        )}

                        <div
                          className="flex items-center gap-3.5 px-5 py-3"
                          style={{
                            borderTop: idx > 0 && !(isClosedRow && idx === 0)
                              ? '1px solid rgba(255,255,255,0.05)'
                              : 'none',
                          }}
                        >
                          <span
                            className="text-[11px] font-700 w-5 text-right shrink-0"
                            style={{ color: isFinalTable ? '#D99962' : '#ffffff' }}
                          >
                            {placeNum ?? '—'}
                          </span>

                          <div className="relative shrink-0">
                            {isPodium && wreathColor && (
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

                          <div className="flex-1 min-w-0">
                            <PlayerNameLink
                              id={p.id}
                              nickname={p.nickname}
                              className="text-[13px] font-600 truncate block"
                              style={
                                isFinalTable
                                  ? {
                                      background: 'linear-gradient(to right, #D99962, #F2D8A7)',
                                      WebkitBackgroundClip: 'text',
                                      WebkitTextFillColor: 'transparent',
                                      backgroundClip: 'text',
                                    }
                                  : { color: '#ffffff' }
                              }
                            />
                            {isAdmin && p.comment?.trim() && (
                              <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: '#f87171' }}>
                                {p.comment}
                              </p>
                            )}
                          </div>

                          <p
                            className="text-[12px] font-700 shrink-0"
                            style={{ color: isFinalTable ? '#D99962' : '#ffffff' }}
                          >
                            {isClosedRow
                              ? (p.place != null ? `+${award.toLocaleString('ru-RU')}` : '—')
                              : p.rating.toLocaleString('ru-RU')}
                          </p>

                        </div>

                        {isClosedRow && p.place === 9 && participants.some((row) => (row.place ?? 0) > 9) && (
                          <div style={{ height: 2, background: 'rgba(217,153,98,0.35)', margin: '4px 16px' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {tournamentFinished && (
              <div
                className="rounded-2xl p-5 space-y-3"
                style={{ background: '#2A211D', border: '1px solid rgba(217,153,98,0.22)' }}
              >
                <h3
                  className="text-[12px] font-700 uppercase tracking-[0.2em]"
                  style={{ color: '#F2D8A7' }}
                >
                  Дилеры
                </h3>
                {!hasDealers ? (
                  <p className="text-[13px]" style={{ color: '#6B6360' }}>
                    Данные о дилерах не заполнены
                  </p>
                ) : (
                  <div className="space-y-2">
                    {playingDealers.map((row) => (
                      <div
                        key={`playing-${row.name}`}
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
                        style={{ background: 'rgba(17,11,9,0.55)' }}
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-700 text-white truncate">{row.name}</p>
                          <p className="text-[10px] font-600 uppercase tracking-wide" style={{ color: '#8c8c88' }}>
                            Играющий
                          </p>
                        </div>
                        <p className="text-[12px] font-700 shrink-0" style={{ color: '#D99962' }}>
                          {formatDealerHours(row.hours)}
                        </p>
                      </div>
                    ))}
                    {nonPlayingDealers.map((row) => (
                      <div
                        key={`staff-${row.name}-${row.hours}-${row.minutes}`}
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
                        style={{ background: 'rgba(17,11,9,0.55)' }}
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-700 text-white truncate">{row.name}</p>
                          <p className="text-[10px] font-600 uppercase tracking-wide" style={{ color: '#8c8c88' }}>
                            Неиграющий
                          </p>
                          {row.loggedAt ? (
                            <p className="text-[10px] font-600 mt-0.5" style={{ color: '#8c8c88' }}>
                              {formatTxDateTime(row.loggedAt)}
                            </p>
                          ) : null}
                        </div>
                        <p className="text-[12px] font-700 shrink-0" style={{ color: '#D99962' }}>
                          {formatDealerHours(row.hours, row.minutes)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isAdmin && live.resultsEntered && (
              <div
                className="rounded-2xl p-5 space-y-4"
                style={{ background: '#2A211D', border: '1px solid rgba(217,153,98,0.22)' }}
              >
                <h3
                  className="text-[12px] font-700 uppercase tracking-[0.2em]"
                  style={{ color: '#F2D8A7' }}
                >
                  Служебная информация
                </h3>

                <section>
                  <p className="text-[11px] font-700 uppercase tracking-[0.14em] mb-2" style={{ color: '#D99962' }}>
                    Комментарии по турниру
                  </p>
                  <p className="text-[13px] font-400 leading-relaxed whitespace-pre-wrap break-words" style={{ color: '#A39B98' }}>
                    {live.adminSecretComment?.trim()
                      ? live.adminSecretComment
                      : 'Комментарий не указан'}
                  </p>
                </section>

                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

                <section>
                  <p className="text-[11px] font-700 uppercase tracking-[0.14em] mb-3" style={{ color: '#D99962' }}>
                    Персонал
                  </p>
                  {(live.staff ?? []).length === 0 ? (
                    <p className="text-[13px]" style={{ color: '#6B6360' }}>Данные не заполнены</p>
                  ) : (
                    <div className="space-y-2.5">
                      {(live.staff ?? []).map((row) => (
                        <div
                          key={row.role}
                          className="flex items-start justify-between gap-3 rounded-xl px-3 py-2.5"
                          style={{ background: 'rgba(17,11,9,0.55)' }}
                        >
                          <div className="min-w-0">
                            <p className="text-[12px] font-700 text-white">{row.role}</p>
                            <p className="text-[12px] truncate" style={{ color: '#A39B98' }}>
                              {row.name || '—'}
                            </p>
                          </div>
                          <p className="text-[12px] font-700 shrink-0" style={{ color: '#D99962' }}>
                            {row.hours}ч {String(row.minutes).padStart(2, '0')}м
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>{/* end scrollable */}

        {/* ── CTA: absolute inside 480px column, transparent wrapper ── */}
        <div className="absolute bottom-4 left-0 right-0 px-4 z-50 pointer-events-none bg-transparent">
          {tournamentFinished ? (
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
