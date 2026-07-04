import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Tournament } from '../types/tournament';
import { TournamentCard } from '../components/TournamentCard';
import { TournamentDetailPage } from './TournamentDetailPage';
import { useTournaments } from '../context/TournamentContext';

type Tab = 'upcoming' | 'finished';

const TAB_ORDER: Tab[] = ['upcoming', 'finished'];

export function TournamentsPage() {
  const { tournaments } = useTournaments();
  const location        = useLocation();
  const navigate        = useNavigate();

  const [activeTab, setActiveTab]                   = useState<Tab>('upcoming');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [backToHome, setBackToHome]                 = useState(false);

  // Track slide direction when switching tabs
  const directionRef = useRef<number>(1);

  const handleTabChange = (tab: Tab) => {
    if (tab === activeTab) return;
    directionRef.current = TAB_ORDER.indexOf(tab) > TAB_ORDER.indexOf(activeTab) ? 1 : -1;
    setActiveTab(tab);
  };

  useEffect(() => {
    const state = location.state as { openTournamentId?: string; from?: string } | null;
    if (state?.openTournamentId) {
      const t = tournaments.find((t) => t.id === state.openTournamentId);
      if (t) { setSelectedTournament(t); setBackToHome(state.from === '/'); }
      window.history.replaceState({}, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCardClick = (t: Tournament) => {
    setSelectedTournament(t);
    setBackToHome(false);
  };

  const handleBack = () => {
    if (backToHome) navigate('/');
    else { setSelectedTournament(null); setBackToHome(false); }
  };

  const filtered = tournaments.filter((t) =>
    activeTab === 'upcoming' ? t.status !== 'finished' : t.status === 'finished'
  );

  if (selectedTournament) {
    return <TournamentDetailPage tournament={selectedTournament} onBack={handleBack} />;
  }

  return (
    <div className="flex flex-col h-full bg-obsidian">
      {/* Header + tabs */}
      <div className="flex-shrink-0 px-5 pt-6 pb-4 space-y-4">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase">
          ТУРНИРЫ
        </h1>

        {/* Tab switcher */}
        <div
          className="relative flex rounded-xl p-1"
          style={{ background: '#1E1612' }}
        >
          {(TAB_ORDER).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className="relative flex-1 py-2.5 text-[13px] font-600 rounded-lg transition-colors duration-200"
              style={{ color: activeTab === tab ? '#0A0908' : '#6B6360' }}
            >
              {activeTab === tab && (
                <motion.span
                  layoutId="tab-active"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.38 }}
                />
              )}
              <span className="relative z-10">
                {tab === 'upcoming' ? 'Текущие' : 'Прошедшие'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Animated tab content */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false} custom={directionRef.current}>
          <motion.div
            key={activeTab}
            custom={directionRef.current}
            variants={{
              enter:  (d: number) => ({ opacity: 0, x: d * 28 }),
              center: { opacity: 1, x: 0 },
              exit:   (d: number) => ({ opacity: 0, x: d * -28 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0 scrollable px-4 pb-4 space-y-3"
          >
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <span className="text-4xl opacity-10 text-white">♠</span>
                <p className="text-[13px] font-500" style={{ color: '#6B6360' }}>
                  {activeTab === 'upcoming' ? 'Предстоящих турниров пока нет' : 'Прошедших турниров нет'}
                </p>
              </div>
            ) : (
              filtered.map((tournament) => (
                /* Dim finished cards */
                <div
                  key={tournament.id}
                  style={
                    tournament.status === 'finished'
                      ? { opacity: 0.52, filter: 'grayscale(0.35)' }
                      : undefined
                  }
                >
                  <TournamentCard tournament={tournament} onClick={handleCardClick} />
                </div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
