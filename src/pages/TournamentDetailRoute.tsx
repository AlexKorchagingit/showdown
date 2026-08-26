import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ScreenLoading } from '../components/ScreenLoading';
import { FetchErrorCard } from '../components/FetchErrorCard';
import { useTournaments } from '../context/TournamentContext';
import { TournamentDetailPage } from './TournamentDetailPage';

export function TournamentDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { tournaments, isLoading, loadError, fetchTournaments } = useTournaments();

  const tournament = tournaments.find((t) => t.id === id);

  if (!tournament && isLoading) {
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
        <ScreenLoading label="Загрузка турнира…" />
      </div>
    );
  }

  if (!tournament && loadError) {
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
        <FetchErrorCard message={loadError} onRetry={() => void fetchTournaments()} />
      </div>
    );
  }

  if (!tournament) {
    return <Navigate to="/tournaments" replace />;
  }

  const handleBack = () => {
    const from = (location.state as { from?: string } | null)?.from;
    if (from === '/') navigate('/');
    else navigate('/tournaments');
  };

  return <TournamentDetailPage tournament={tournament} onBack={handleBack} />;
}
