import type { CreateChargeInput } from './financeApi';
import type { Transaction } from '../types/finance';

type ChargeIntent = Omit<CreateChargeInput, 'requestId'>;

/** Reuse an operation ID after an ambiguous network failure; no credentials are stored.
 * The queue lives for this mounted session only, not across reloads/new devices.
 */
export function createChargeRequests(
  send: (input: CreateChargeInput) => Promise<Transaction>,
  createId = () => crypto.randomUUID(),
) {
  const requests = new Map<string, { requestId: string; pending?: Promise<Transaction> }>();
  return (intent: ChargeIntent): Promise<Transaction> => {
    const normalized = { tournamentId: intent.tournamentId, userId: intent.userId,
      type: intent.type, comment: intent.comment?.trim() ?? '' };
    const key = JSON.stringify(normalized);
    const request = requests.get(key) ?? { requestId: createId() };
    if (request.pending) return request.pending;
    requests.set(key, request);
    request.pending = Promise.resolve().then(() => send({ ...normalized, requestId: request.requestId }))
      .then((saved) => { requests.delete(key); return saved; }, (error) => {
        request.pending = undefined;
        throw error;
      });
    return request.pending;
  };
}
