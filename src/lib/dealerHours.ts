import { createOperationRequests, type RequestPersistence } from './operationRequests';

export type DealerHours = {
  tournamentId: string;
  userId: string;
  hours: number;
  revision: number;
  loggedAt?: string;
};
export type DealerHoursIntent = { tournamentId: string; userId: string; delta: number };
export type DealerHoursInput = DealerHoursIntent & { requestId: string };

export function dealerKey(tournamentId: string, userId: string) {
  return JSON.stringify([tournamentId, userId]);
}

export function mergeDealerHours(previous: Record<string, DealerHours>, rows: DealerHours[]) {
  const next = { ...previous };
  for (const row of rows) {
    const key = dealerKey(row.tournamentId, row.userId);
    if (!next[key] || next[key].revision <= row.revision) next[key] = row;
  }
  return next;
}

export function createDealerHoursRequests(
  send: (input: DealerHoursInput) => Promise<DealerHours>,
  createId?: () => string,
  persistence?: RequestPersistence,
) {
  return createOperationRequests<DealerHoursIntent, DealerHours>(send, (intent) => ({
    tournamentId: intent.tournamentId, userId: intent.userId, delta: intent.delta,
  }), 'showdown.dealer-hours.v1', createId, persistence);
}
