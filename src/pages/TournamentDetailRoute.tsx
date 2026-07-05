import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTournaments } from '../context/TournamentContext';
import { TournamentDetailPage } from './TournamentDetailPage';

export function TournamentDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { tournaments } = useTournaments();

  const tournament = tournaments.find((t) => t.id === id);

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
