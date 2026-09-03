import type { CreateChargeInput } from './financeApi';
import type { Transaction } from '../types/finance';
import { createOperationRequests, type RequestPersistence } from './operationRequests';

type ChargeIntent = Omit<CreateChargeInput, 'requestId'>;

export function createChargeRequests(
  send: (input: CreateChargeInput) => Promise<Transaction>,
  createId?: () => string,
  persistence?: RequestPersistence,
) {
  return createOperationRequests<ChargeIntent, Transaction>(send, (intent) => ({
    tournamentId: intent.tournamentId, userId: intent.userId,
    type: intent.type, comment: intent.comment?.trim() ?? '',
  }), 'showdown.charge.v1', createId, persistence);
}
