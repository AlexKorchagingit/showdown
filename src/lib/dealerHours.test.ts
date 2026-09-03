import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc:vi.fn(), from:vi.fn() }));
vi.mock('./supabase', () => ({ supabase:mocks, logSupabaseError:vi.fn() }));
import { adjustDealerHoursOnServer, fetchFinanceSnapshot } from './financeApi';
import { createDealerHoursRequests, dealerKey, mergeDealerHours } from './dealerHours';
import { createChargeRequests } from './chargeRequests';

const row = { tournament_id:'event', user_id:'player', hours:2.5, revision:3, logged_at:'2026-09-03T12:00:00Z' };
const saved = { tournamentId:'event', userId:'player', hours:2.5, revision:3, loggedAt:row.logged_at };
const input = { requestId:'11111111-1111-4111-8111-111111111111', tournamentId:'event',userId:'player',delta:0.5 };
beforeEach(() => vi.clearAllMocks());

describe('server-owned registered dealer hours', () => {
  it('sends a delta and retry ID, never a client total, timestamp or actor', async () => {
    mocks.rpc.mockResolvedValue({data:row,error:null});
    const result = await adjustDealerHoursOnServer({...input,hours:999,admin_id:'forged'} as typeof input);
    expect(mocks.rpc).toHaveBeenCalledWith('club_adjust_dealer_hours',{
      p_request_id:input.requestId,p_tournament_id:'event',p_user_id:'player',p_delta:0.5,
    });
    expect(result).toEqual(saved);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('rejects invalid deltas before sending anything', async () => {
    for (const delta of [0,1,NaN,Infinity,-1,0.1]) {
      await expect(adjustDealerHoursOnServer({...input,delta})).rejects.toThrow('полчаса');
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not accept a wrong target, missing confirmation or invalid revision', async () => {
    for (const data of [null,{...row,user_id:'other'},{...row,hours:-1},{...row,revision:NaN},
      {...row,revision:1.1},{...row,logged_at:'bad date'}]) {
      mocks.rpc.mockResolvedValue({data,error:null});
      await expect(adjustDealerHoursOnServer(input)).rejects.toThrow();
    }
    mocks.rpc.mockResolvedValue({data:null,error:{message:'private provider details'}});
    await expect(adjustDealerHoursOnServer(input)).rejects.not.toThrow('private provider details');
  });
  it('reads finances through a no-identity RPC and refuses incomplete snapshots', async () => {
    mocks.rpc.mockResolvedValue({data:{transactions:[],dealer_hours:[row]},error:null});
    expect(await fetchFinanceSnapshot()).toEqual({transactions:[],dealerHours:[saved]});
    expect(mocks.rpc).toHaveBeenCalledWith('club_finance_snapshot');
    expect(mocks.from).not.toHaveBeenCalled();
    for (const data of [null,{transactions:[]},{transactions:[null],dealer_hours:[]}]) {
      mocks.rpc.mockResolvedValue({data,error:null});
      await expect(fetchFinanceSnapshot()).rejects.toThrow();
    }
  });
  it('does not replace a newer server revision with a delayed response', () => {
    const key = dealerKey('event','player');
    const current = {[key]:saved};
    expect(mergeDealerHours(current,[{...saved,revision:2,hours:1}])[key]).toEqual(saved);
    expect(mergeDealerHours(current,[{...saved,revision:4,hours:3}])[key].hours).toBe(3);
    expect(dealerKey('a:b','c')).not.toBe(dealerKey('a','b:c'));
  });
  it('recovers a lost hours request after reload without sharing the cashier namespace', async () => {
    const values = new Map<string,string>();
    const storage = {getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
    const persistence = {scope:'verified-admin',storage:()=>storage};
    const offline = vi.fn().mockRejectedValue(new Error('lost response'));
    await expect(createDealerHoursRequests(offline,()=>input.requestId,persistence)(input)).rejects.toThrow();
    await expect(createChargeRequests(offline,()=>input.requestId,persistence)({tournamentId:'event',userId:'player',type:'buy-in'})).rejects.toThrow();
    expect([...values.keys()].some((key)=>key.startsWith('showdown.charge.v1.'))).toBe(true);
    expect([...values.keys()].some((key)=>key.startsWith('showdown.dealer-hours.v1.'))).toBe(true);
    const send = vi.fn().mockResolvedValue(saved);
    await createDealerHoursRequests(send,()=> '22222222-2222-4222-8222-222222222222',persistence)(input);
    expect(send.mock.calls[0][0].requestId).toBe(input.requestId);
    expect(values.size).toBe(1);
  });
});
