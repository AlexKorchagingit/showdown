import { useState } from 'react';
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
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

  const filtered = tournaments.filter((t) =>
    activeTab === 'upcoming' ? t.status !== 'finished' : t.status === 'finished'
  );

  if (selectedTournament) {
    return (
      <TournamentDetailPage
        tournament={selectedTournament}
        onBack={() => setSelectedTournament(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-5 pt-6 pb-4 space-y-4">
        <h1 className="text-center text-xl font-bold tracking-[0.2em] text-white uppercase">
          ТУРНИРЫ
        </h1>

        {/* Tab switcher */}
        <div
          className="relative flex rounded-xl p-1"
          style={{ background: '#5a1c0c' }}
        >
          {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200"
              style={{ color: activeTab === tab ? '#0D0000' : '#8C4C27' }}
            >
              {activeTab === tab && (
                <span
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #8C4C27, #D99962)' }}
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
            <span className="text-4xl" style={{ color: '#400904' }}>♠</span>
            <p className="text-sm" style={{ color: '#8C4C27' }}>
              {activeTab === 'upcoming'
                ? 'Предстоящих турниров пока нет'
                : 'Прошедших турниров нет'}
            </p>
          </div>
        ) : (
          filtered.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              onClick={setSelectedTournament}
            />
          ))
        )}
      </div>
    </div>
  );
}
