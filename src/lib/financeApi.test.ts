import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: mocks, logSupabaseError: vi.fn() }));
import { createCharge, markTransactionsPaid } from './financeApi';
import { createChargeRequests } from './chargeRequests';

const row = { id: 'synthetic-tx', tournament_id: 'event', user_id: 'member',
  date: '2026-09-03T10:00:00Z', amount: 1000, type: 'buy-in', status: 'unpaid',
  comment: '', is_dealer: false, dealer_hours: 0, updated_at: null };
const input = { requestId: 'synthetic-request', tournamentId: 'event', userId: 'member', type: 'buy-in' as const };
beforeEach(() => vi.clearAllMocks());

describe('server cashier commands', () => {
  it('sends only allowed command parameters; uses the server amount, identity and date', async () => {
    mocks.rpc.mockResolvedValue({ data: row, error: null });
    const result = await createCharge({ ...input, amount: 1, status: 'paid', admin_id: 'forged' } as typeof input);
    expect(mocks.rpc).toHaveBeenCalledWith('club_create_charge', {
      p_request_id: input.requestId, p_tournament_id: 'event', p_user_id: 'member', p_type: 'buy-in', p_comment: '',
    });
    expect(result.amount).toBe(1000);
    expect(result.status).toBe('unpaid');
    expect(result.date).toBe(row.date);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('does not synthesize success or expose provider details after an error', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'synthetic-private-error' } });
    await expect(createCharge(input)).rejects.toThrow('Не удалось подтвердить');
    await expect(createCharge(input)).rejects.not.toThrow('synthetic-private-error');
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(createCharge(input)).rejects.toThrow('Сервер не подтвердил');
  });
  it('marks payment with IDs only and uses the persisted server timestamp', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ ...row, status: 'paid', updated_at: '2026-09-03T12:00:00Z' }], error: null });
    const saved = await markTransactionsPaid([row.id]);
    expect(mocks.rpc).toHaveBeenCalledWith('club_mark_paid', { p_transaction_ids: [row.id] });
    expect(saved[0].updatedAt).toBe('2026-09-03T12:00:00Z');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('rejects an incomplete or mismatched payment confirmation', async () => {
    for (const data of [[], [row], [{ ...row, status: 'paid', id: 'other' }], [null]]) {
      mocks.rpc.mockResolvedValue({ data, error: null });
      await expect(markTransactionsPaid([row.id])).rejects.toThrow('подтвердил');
    }
    expect(await markTransactionsPaid([])).toEqual([]);
  });
});

describe('cashier request identity', () => {
  it('coalesces rapid clicks and reuses the same request ID after an ambiguous failure', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValue(row);
    const createId = vi.fn().mockReturnValueOnce('request-one').mockReturnValueOnce('request-two');
    const submit = createChargeRequests(send, createId);
    const first = submit(input);
    const second = submit(input);
    expect(first).toBe(second);
    await expect(first).rejects.toThrow('timeout');
    await expect(submit(input)).resolves.toEqual(row);
    expect(send.mock.calls.map(([arg]) => arg.requestId)).toEqual(['request-one','request-one']);
    await submit(input);
    expect(send.mock.calls[2][0].requestId).toBe('request-two');
  });
  it('does not conflate independent users or charge types', async () => {
    const send = vi.fn().mockResolvedValue(row);
    const createId = vi.fn().mockReturnValueOnce('a').mockReturnValueOnce('b');
    const submit = createChargeRequests(send, createId);
    await Promise.all([submit(input), submit({ ...input, type: 'rebuy' })]);
    expect(send.mock.calls.map(([arg]) => arg.requestId)).toEqual(['a','b']);
  });
});
