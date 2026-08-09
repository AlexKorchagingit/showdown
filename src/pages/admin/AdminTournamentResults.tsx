import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import { useTournaments } from '../../context/TournamentContext';
import { ratingPointsForPlace, payoutShareForPlace } from '../../data/prizeStructure';

export function AdminTournamentResults() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tournaments, updateTournament } = useTournaments();
  const tournament = tournaments.find((t) => t.id === id);

  const initialPlaces = useMemo(() => {
    const map: Record<string, number | ''> = {};
    tournament?.participants.forEach((p) => {
      map[p.id] = p.place ?? '';
    });
    return map;
  }, [tournament]);

  const [places, setPlaces] = useState<Record<string, number | ''>>(initialPlaces);

  if (!tournament) return <Navigate to="/admin/tournaments" replace />;
  if (tournament.resultsEntered) {
    return <Navigate to="/admin/tournaments" replace />;
  }

  const setPlace = (participantId: string, value: string) => {
    setPlaces((prev) => ({
      ...prev,
      [participantId]: value === '' ? '' : Number(value),
    }));
  };

  const usedPlaces = new Set(
    Object.values(places).filter((v): v is number => typeof v === 'number' && v > 0),
  );

  const allAssigned =
    tournament.participants.length > 0 &&
    tournament.participants.every((p) => typeof places[p.id] === 'number' && (places[p.id] as number) > 0);

  const uniqueOk =
    allAssigned &&
    usedPlaces.size === tournament.participants.length;

  const handleSave = () => {
    if (!uniqueOk) return;

    const nextParticipants = tournament.participants.map((p) => {
      const place = places[p.id] as number;
      const bonus = ratingPointsForPlace(place, tournament.guarantee);
      return {
        ...p,
        place,
        rating: p.rating + bonus,
      };
    });

    updateTournament(tournament.id, {
      participants: nextParticipants,
      resultsEntered: true,
    });
    navigate('/admin/tournaments');
  };

  const placeOptions = Array.from(
    { length: tournament.participants.length },
    (_, i) => i + 1,
  );

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <button
        type="button"
        onClick={() => navigate('/admin/tournaments')}
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

      <div className="flex-shrink-0 px-5 pt-20 pb-4">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase mb-2">
          Итоги
        </h1>
        <p className="text-center text-[13px] font-600 text-[#D99962] uppercase tracking-wide">
          {tournament.title}
        </p>
        <p className="text-center text-[11px] mt-1" style={{ color: '#8c8c88' }}>
          Гарантия {tournament.guarantee.toLocaleString('ru-RU')} → очки рейтинга по призовой сетке
        </p>
      </div>

      <div
        className="flex-1 scrollable px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)' }}
      >
        <div className="rounded-2xl overflow-hidden" style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}>
          {tournament.participants.map((p, idx) => {
            const place = places[p.id];
            const bonus =
              typeof place === 'number' ? ratingPointsForPlace(place, tournament.guarantee) : 0;
            const share =
              typeof place === 'number' ? payoutShareForPlace(place) : null;

            return (
              <div
                key={p.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-700 shrink-0"
                  style={{ background: 'rgba(140,76,39,0.28)', color: '#c8a38e' }}
                >
                  {p.nickname[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-600 text-white truncate">{p.nickname}</p>
                  <p className="text-[11px]" style={{ color: '#8c8c88' }}>
                    {bonus > 0
                      ? `+${bonus.toLocaleString('ru-RU')} очков${share != null ? ` (${share}%)` : ''}`
                      : 'Место не выбрано'}
                  </p>
                </div>

                <select
                  value={place === '' ? '' : String(place)}
                  onChange={(e) => setPlace(p.id, e.target.value)}
                  className="shrink-0 bg-[#231A16] text-white border border-[#D99962]/30 rounded-lg px-2 py-2 text-[13px] font-700 outline-none [color-scheme:dark]"
                  aria-label={`Место для ${p.nickname}`}
                >
                  <option value="">—</option>
                  {placeOptions.map((n) => {
                    const takenByOther =
                      typeof places[p.id] === 'number' && places[p.id] === n
                        ? false
                        : usedPlaces.has(n);
                    return (
                      <option key={n} value={n} disabled={takenByOther}>
                        {n} место
                      </option>
                    );
                  })}
                </select>
              </div>
            );
          })}
        </div>

        {!uniqueOk && tournament.participants.length > 0 && (
          <p className="text-center text-[11px] mt-3" style={{ color: '#6B6360' }}>
            Назначьте уникальное место каждому участнику
          </p>
        )}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 px-4 pb-5 pt-3"
        style={{ background: 'linear-gradient(to top, #110b09 70%, transparent)' }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={!uniqueOk}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-[15px] transition-all active:scale-[0.98] ${
            uniqueOk
              ? 'text-[#0A0908]'
              : 'opacity-50 cursor-not-allowed bg-[#463129] text-white/50'
          }`}
          style={
            uniqueOk
              ? {
                  background: 'linear-gradient(to right, #8C4C27, #D99962)',
                  boxShadow: '0 0 16px rgba(217,153,98,0.28)',
                }
              : undefined
          }
        >
          <Trophy size={18} strokeWidth={2.4} />
          Сохранить итоги
        </button>
      </div>
    </div>
  );
}
