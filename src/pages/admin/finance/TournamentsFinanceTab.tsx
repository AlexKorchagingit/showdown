import { useNavigate } from 'react-router-dom';
import { useTournaments } from '../../../context/TournamentContext';
import { TournamentCard } from '../../../components/TournamentCard';
import { compareByStart, isFinished } from '../../../lib/tournamentStatus';

export function TournamentsFinanceTab() {
  const navigate = useNavigate();
  const { tournaments } = useTournaments();

  const sorted = [...tournaments].sort((a, b) => {
    const aFinished = isFinished(a);
    if (aFinished !== isFinished(b)) return aFinished ? 1 : -1;
    return aFinished ? compareByStart(b, a) : compareByStart(a, b);
  });

  if (sorted.length === 0) {
    return (
      <p className="text-center text-[13px] pt-10" style={{ color: '#6B6360' }}>
        Турниров пока нет
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((tournament) => (
        <div
          key={tournament.id}
          className={isFinished(tournament) ? 'opacity-55' : ''}
        >
          <TournamentCard
            tournament={tournament}
            onClick={(t) => navigate(`/admin/finance/tournaments/${t.id}`)}
          />
        </div>
      ))}
    </div>
  );
}
