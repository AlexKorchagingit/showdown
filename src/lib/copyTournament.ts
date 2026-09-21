import type { Participant, Tournament } from '../types/tournament';

/**
 * Draft for «Скопировать турнир»: keep settings and (optional) seats,
 * drop cashier notes, close-state, personnel and finishing table.
 */
export function copiedTournamentDraft(
  source: Tournament,
  participants: Participant[],
): Omit<Tournament, 'id'> {
  const { id: _id, ...rest } = source;
  return {
    ...rest,
    title: `${source.title} Copy`,
    participants,
    features: [...source.features],
    isClosed: false,
    hidden: false,
    rubiesDistributed: false,
    resultsEntered: false,
    adminSecretComment: undefined,
    dealers: undefined,
    staff: undefined,
    results: undefined,
  };
}
