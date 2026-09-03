import type { CreateChargeInput } from './financeApi';
import type { Transaction } from '../types/finance';

type ChargeIntent = Omit<CreateChargeInput, 'requestId'>;
type RequestPersistence = {
  scope: string;
  storage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_ERROR = 'Не удалось сохранить идентификатор операции. Не создавайте счёт заново: проверьте журнал и доступность хранилища браузера.';

/** Reuse an operation ID after an ambiguous failure, including a same-tab reload.
 * Persistence contains only a hashed intent key and UUID, never credentials/comments.
 * It does not coordinate separate devices or tabs with independent storage.
 */
export function createChargeRequests(
  send: (input: CreateChargeInput) => Promise<Transaction>,
  createId: () => string = () => crypto.randomUUID(),
  persistence?: RequestPersistence,
) {
  const requests = new Map<string, { requestId: string; pending?: Promise<Transaction> }>();
  return (intent: ChargeIntent): Promise<Transaction> => {
    const normalized = { tournamentId: intent.tournamentId, userId: intent.userId,
      type: intent.type, comment: intent.comment?.trim() ?? '' };
    const key = JSON.stringify(normalized);
    const request = requests.get(key) ?? { requestId: createId() };
    if (request.pending) return request.pending;
    requests.set(key, request);
    let persisted: { storage: ReturnType<RequestPersistence['storage']>; key: string } | undefined;
    request.pending = Promise.resolve().then(async () => {
      if (persistence) {
        try {
          if (!persistence.scope) throw new Error('Missing verified account');
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(
            JSON.stringify([persistence.scope, normalized]),
          ));
          const storageKey = 'showdown.charge.v1.' + Array.from(new Uint8Array(digest),
            (byte) => byte.toString(16).padStart(2, '0')).join('');
          const storage = persistence.storage();
          const previous = storage.getItem(storageKey);
          if (previous !== null) request.requestId = previous;
          if (!UUID.test(request.requestId)) throw new Error('Invalid operation identity');
          storage.setItem(storageKey, request.requestId);
          if (storage.getItem(storageKey) !== request.requestId) throw new Error('Persistence failed');
          persisted = { storage, key: storageKey };
        } catch {
          // Never send an operation whose retry ID cannot be safely recovered.
          throw new Error(STORAGE_ERROR);
        }
      }
      return send({ ...normalized, requestId: request.requestId });
    }).then((saved) => {
      if (persisted) {
        try {
          // An older mounted queue must not erase a newer operation's retry ID.
          if (persisted.storage.getItem(persisted.key) === request.requestId) {
            persisted.storage.removeItem(persisted.key);
            if (persisted.storage.getItem(persisted.key) === request.requestId) throw new Error('Cleanup failed');
          }
        } catch { throw new Error(STORAGE_ERROR); }
      }
      requests.delete(key);
      return saved;
    }).catch((error) => {
        request.pending = undefined;
        throw error;
      });
    return request.pending;
  };
}
