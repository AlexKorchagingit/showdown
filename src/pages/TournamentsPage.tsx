import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Tournament } from '../types/tournament';
import { TournamentCard } from '../components/TournamentCard';
import { TournamentDetailPage } from './TournamentDetailPage';
import { useTournaments } from '../context/TournamentContext';

type Tab = 'upcoming' | 'finished';

const TAB_LABELS: Record<Tab, string> = {
  upcoming: 'Текущие',
  finished: 'Прошедшие',
};

export function TournamentsPage() {
  const { tournaments } = useTournaments();
  const location        = useLocation();
  const navigate        = useNavigate();

  const [activeTab, setActiveTab]               = useState<Tab>('upcoming');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  // Remembers whether we should go back to '/' or stay here
  const [backToHome, setBackToHome]             = useState(false);

  // Auto-open tournament if navigated here with state from HomePage hero card
  useEffect(() => {
    const state = location.state as { openTournamentId?: string; from?: string } | null;
    if (state?.openTournamentId) {
      const t = tournaments.find((t) => t.id === state.openTournamentId);
      if (t) {
        setSelectedTournament(t);
        setBackToHome(state.from === '/');
      }
      window.history.replaceState({}, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCardClick = (t: Tournament) => {
    setSelectedTournament(t);
    setBackToHome(false); // came from tournament list, not from home
  };

  const handleBack = () => {
    if (backToHome) {
      navigate('/');
    } else {
      setSelectedTournament(null);
      setBackToHome(false);
    }
  };

  const filtered = tournaments.filter((t) =>
    activeTab === 'upcoming' ? t.status !== 'finished' : t.status === 'finished'
  );

  if (selectedTournament) {
    return (
      <TournamentDetailPage
        tournament={selectedTournament}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-obsidian">
      <div className="flex-shrink-0 px-5 pt-6 pb-4 space-y-4">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase">
          ТУРНИРЫ
        </h1>

        {/* Tab switcher */}
        <div
          className="relative flex rounded-xl p-1"
          style={{ background: '#1E1612' }}
        >
          {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative flex-1 py-2.5 text-[13px] font-600 rounded-lg transition-all duration-200"
              style={{ color: activeTab === tab ? '#0A0908' : '#6B6360' }}
            >
              {activeTab === tab && (
                <span
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
                />
              )}
              <span className="relative z-10">{TAB_LABELS[tab]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 scrollable px-4 pb-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-8">
            <span className="text-4xl opacity-10 text-white">♠</span>
            <p className="text-[13px] font-500" style={{ color: '#6B6360' }}>
              {activeTab === 'upcoming' ? 'Предстоящих турниров пока нет' : 'Прошедших турниров нет'}
            </p>
          </div>
        ) : (
          filtered.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              onClick={handleCardClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
