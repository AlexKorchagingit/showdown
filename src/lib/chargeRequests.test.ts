import { describe, expect, it, vi } from 'vitest';
import { createChargeRequests } from './chargeRequests';
import type { Transaction } from '../types/finance';

const firstId = '11111111-1111-4111-8111-111111111111';
const nextId = '22222222-2222-4222-8222-222222222222';
const intent = { tournamentId: 'test-event', userId: 'test-player', type: 'ticket' as const, comment: 'private test comment' };
const saved = { id: 'synthetic-transaction' } as Transaction;
function memoryStorage() {
  const values = new Map<string,string>();
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string,value: string) => { values.set(key,value); },
    removeItem: (key: string) => { values.delete(key); } };
}

describe('reload-safe cashier request identity', () => {
  it('recovers the same ID after an ambiguous failure and reload, then clears it after confirmation', async () => {
    const storage = memoryStorage();
    const persistence = { scope: 'verified-admin', storage: () => storage };
    const offline = vi.fn().mockRejectedValue(new Error('lost response'));
    await expect(createChargeRequests(offline, () => firstId, persistence)(intent)).rejects.toThrow('lost response');
    expect(storage.values.size).toBe(1);
    const recovered = vi.fn().mockResolvedValue(saved);
    const afterReload = createChargeRequests(recovered, () => nextId, persistence);
    await afterReload(intent);
    expect(recovered.mock.calls[0][0].requestId).toBe(firstId);
    expect(storage.values.size).toBe(0);
    await afterReload(intent);
    expect(recovered.mock.calls[1][0].requestId).toBe(nextId);
  });
  it('persists only a hashed key and UUID before sending the request', async () => {
    const storage = memoryStorage();
    const send = vi.fn(async () => {
      expect([...storage.values.keys()][0]).toMatch(/^showdown\.charge\.v1\.[a-f0-9]{64}$/);
      expect([...storage.values.values()]).toEqual([firstId]);
      expect(JSON.stringify([...storage.values])).not.toContain(intent.comment);
      expect(JSON.stringify([...storage.values])).not.toContain(intent.userId);
      return saved;
    });
    await createChargeRequests(send, () => firstId, { scope: 'admin', storage: () => storage })(intent);
    expect(send).toHaveBeenCalledOnce();
  });
  it('never sends if storage is blocked, full, silently discards writes or the account is unverified', async () => {
    const send = vi.fn().mockResolvedValue(saved);
    for (const persistence of [
      { scope: 'admin', storage: () => { throw new Error('blocked'); } },
      { scope: 'admin', storage: () => ({ ...memoryStorage(), setItem: () => { throw new Error('quota'); } }) },
      { scope: 'admin', storage: () => ({ ...memoryStorage(), setItem: () => {} }) },
      { scope: '', storage: () => memoryStorage() },
    ]) {
      await expect(createChargeRequests(send, () => firstId, persistence)(intent)).rejects.toThrow('идентификатор');
    }
    expect(send).not.toHaveBeenCalled();
  });
  it('does not share operation IDs across different verified administrators', async () => {
    const storage = memoryStorage();
    const send = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(createChargeRequests(send, () => firstId, { scope:'admin-a', storage:()=>storage })(intent)).rejects.toThrow();
    await expect(createChargeRequests(send, () => nextId, { scope:'admin-b', storage:()=>storage })(intent)).rejects.toThrow();
    expect(send.mock.calls.map(([args]) => args.requestId)).toEqual([firstId,nextId]);
    expect(storage.values.size).toBe(2);
  });
  it('refuses a corrupt persisted identifier without replacing it or sending a fresh charge', async () => {
    const storage = memoryStorage();
    const send = vi.fn().mockRejectedValue(new Error('offline'));
    const persistence = { scope:'admin', storage:()=>storage };
    await expect(createChargeRequests(send, () => firstId, persistence)(intent)).rejects.toThrow();
    const key = [...storage.values.keys()][0];
    storage.values.set(key,'broken');
    send.mockClear();
    await expect(createChargeRequests(send, () => nextId, persistence)(intent)).rejects.toThrow('идентификатор');
    expect(send).not.toHaveBeenCalled();
    expect(storage.values.get(key)).toBe('broken');
  });
  it('does not erase a newer operation when an older response arrives late', async () => {
    const storage = memoryStorage();
    const send = vi.fn(async () => {
      const key = [...storage.values.keys()][0];
      storage.values.set(key,nextId);
      return saved;
    });
    await createChargeRequests(send, () => firstId, { scope:'admin', storage:()=>storage })(intent);
    expect([...storage.values.values()]).toEqual([nextId]);
  });
  it('retains the retry ID when acknowledgement cleanup fails', async () => {
    const storage = memoryStorage();
    const remove = vi.spyOn(storage,'removeItem').mockImplementationOnce(() => { throw new Error('blocked'); });
    const send = vi.fn().mockResolvedValue(saved);
    const persistence = { scope:'admin', storage:()=>storage };
    await expect(createChargeRequests(send, () => firstId, persistence)(intent)).rejects.toThrow('идентификатор');
    await createChargeRequests(send, () => nextId, persistence)(intent);
    expect(send.mock.calls.map(([args]) => args.requestId)).toEqual([firstId,firstId]);
    expect(storage.values.size).toBe(0);
    remove.mockRestore();
  });
});
