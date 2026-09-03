import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc:vi.fn(),from:vi.fn() }));
vi.mock('./supabase',() => ({ supabase:mocks,logSupabaseError:vi.fn() }));
import { createPersonnelRequests, fetchPersonnel, mergePersonnel, parsePersonnelRoster, sendPersonnelCommand, withPersonnel,
  type PersonnelIntent } from './personnel';
import { insertTournament, tournamentWriteRow, updateTournamentRow } from './tournamentApi';
import { tournamentFromRow, tournamentToRow } from './supabaseMap';
import { computePlayerAdminStats } from './playerAnalytics';
import type { Tournament } from '../types/tournament';

const raw = { tournament_id:'event',revision:3,entries:[{ id:'entry',kind:'dealer',archived_at:null,archive_reason:null,
  data:{ name:'Same name',hours:2,minutes:15,comment:'Note',loggedAt:'2026-09-03T12:00:00Z' } }] };
const saved = parsePersonnelRoster(raw);
const tournament: Tournament = { id:'event',title:'Test',imageUrl:'',address:'',startDate:'2026-09-03',startTime:'19:00',
  totalSeats:27,guarantee:0,about:'',features:[],participants:[],lateRegUntil:'21:00',blindStructure:'Test',
  stackSize:30000,levelDuration:'15',isClosed:false,dealers:[{ name:'Legacy',hours:100,minutes:0 }],
  staff:[{ role:'Admin',name:'Legacy staff',hours:50,minutes:0 }] };
const intent: PersonnelIntent = { tournamentId:'event',action:'add_dealer',values:{ name:' Same name ',minutes:90 } };
const requestId = '11111111-1111-4111-8111-111111111111';
beforeEach(() => vi.clearAllMocks());

describe('protected personnel client',() => {
  it('uses a no-identity snapshot RPC and validates all rows before accepting the result',async () => {
    mocks.rpc.mockResolvedValue({ data:[raw],error:null });
    expect(await fetchPersonnel()).toEqual([saved]);
    expect(mocks.rpc).toHaveBeenCalledWith('club_personnel_snapshot');
    expect(mocks.from).not.toHaveBeenCalled();
    for (const data of [null,[raw,raw],[raw,null]]) {
      mocks.rpc.mockResolvedValue({ data,error:null });
      await expect(fetchPersonnel()).rejects.toThrow();
    }
  });
  it('passes only command fields, never a client actor or server timestamp',async () => {
    mocks.rpc.mockResolvedValue({ data:raw,error:null });
    const input = { ...intent,requestId,actor_id:'forged',loggedAt:'2000-01-01' };
    expect(await sendPersonnelCommand(input)).toEqual(saved);
    expect(mocks.rpc).toHaveBeenCalledWith('club_personnel_command',{
      p_request_id:requestId,p_tournament_id:'event',p_action:'add_dealer',p_entry_id:null,p_values:intent.values,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('refuses malformed or wrong-target confirmations and does not display provider internals',async () => {
    for (const data of [null,{ ...raw,tournament_id:'other' },{ ...raw,revision:-1 }]) {
      mocks.rpc.mockResolvedValue({ data,error:null });
      await expect(sendPersonnelCommand({ ...intent,requestId })).rejects.toThrow('не подтвердил');
    }
    mocks.rpc.mockResolvedValue({ data:null,error:{ message:'private diagnostic',code:'PT409' } });
    await expect(sendPersonnelCommand({ ...intent,requestId })).rejects.toThrow('другим администратором');
    mocks.rpc.mockResolvedValue({ data:null,error:{ message:'private diagnostic' } });
    await expect(sendPersonnelCommand({ ...intent,requestId })).rejects.not.toThrow('private diagnostic');
  });
  it('rejects corrupt hours, dates, missing staff role and duplicate identities',() => {
    const entry = raw.entries[0];
    for (const data of [{ ...entry.data,hours:-1 },{ ...entry.data,minutes:NaN },{ ...entry.data,hours:0.5 },
      { ...entry.data,loggedAt:'invalid' },{ ...entry.data,name:123 }]) {
      expect(() => parsePersonnelRoster({ ...raw,entries:[{ ...entry,data }] })).toThrow();
    }
    for (const entries of [[entry,entry],[{ ...entry,kind:'staff' }],[{ ...entry,archived_at:'invalid' }]]) {
      expect(() => parsePersonnelRoster({ ...raw,entries })).toThrow();
    }
  });
  it('preserves unusual but valid legacy minutes and ignores unknown source properties',() => {
    const legacy = parsePersonnelRoster({ ...raw,entries:[{ ...raw.entries[0],data:{ ...raw.entries[0].data,minutes:60,legacyExtra:'private' } }] });
    expect(legacy.entries[0].data.minutes).toBe(60);
    expect(legacy.entries[0].data).not.toHaveProperty('legacyExtra');
  });
  it('keeps the newest revision including archive and drops records outside a fresh snapshot',() => {
    const newer = { ...saved,revision:4,entries:[{ ...saved.entries[0],archivedAt:'2026-09-03T13:00:00Z',archiveReason:'Duplicate' }] };
    expect(mergePersonnel({ event:newer },[saved]).event).toEqual(newer);
    expect(mergePersonnel({ event:newer },[],true)).toEqual({});
    expect(withPersonnel(tournament,newer).dealers).toEqual([]);
  });
  it('never falls back to legacy public lists and separates staff from dealers',() => {
    expect(withPersonnel(tournament).dealers).toEqual([]);
    expect(withPersonnel(tournament).staff).toEqual([]);
    expect(tournamentFromRow(tournamentToRow(tournament),[]).dealers).toBeUndefined();
    expect(withPersonnel(tournament,saved).dealers).toEqual([saved.entries[0].data]);
  });
  it('omits protected lists from generic writes and refuses personnel in creation before any write',async () => {
    expect(tournamentWriteRow(tournament)).not.toHaveProperty('staff');
    expect(tournamentWriteRow(tournament)).not.toHaveProperty('dealers');
    await expect(insertTournament(tournament)).rejects.toThrow('Сначала создайте турнир');
    expect(mocks.from).not.toHaveBeenCalled();
    const eq = vi.fn().mockResolvedValue({ error:null });
    const update = vi.fn((_payload: object) => ({ eq }));
    mocks.from.mockReturnValue({ update });
    await updateTournamentRow(tournament);
    expect(update.mock.calls[0][0]).not.toHaveProperty('dealers');
    expect(update.mock.calls[0][0]).not.toHaveProperty('staff');
  });
  it('does not attach an unbound dealer to a player just because their names match',() => {
    const visible = withPersonnel(tournament,saved);
    const stats = computePlayerAdminStats('player','Same name',[visible],[],() => 0);
    expect(stats.dealerHours).toBe(0);
    const linked = computePlayerAdminStats('player','Same name',[visible],[],() => 1.5);
    expect(linked.dealerHours).toBe(1.5);
    expect(visible.dealers?.[0].hours).toBe(2);
  });
  it('recovers an uncertain operation after same-tab reload without persisting names/comments',async () => {
    const values = new Map<string,string>();
    const storage = { getItem:(key:string) => values.get(key) ?? null,
      setItem:(key:string,value:string) => { values.set(key,value); },removeItem:(key:string) => { values.delete(key); } };
    const persistence = { scope:'verified-admin',storage:() => storage };
    const offline = vi.fn().mockRejectedValue(new Error('lost response'));
    await expect(createPersonnelRequests(offline,() => requestId,persistence)(intent)).rejects.toThrow();
    expect(values.size).toBe(1);
    expect([...values.keys()][0]).toMatch(/^showdown\.personnel\.v1\.[0-9a-f]{64}$/);
    expect([...values.values()]).toEqual([requestId]);
    const send = vi.fn().mockResolvedValue(saved);
    await createPersonnelRequests(send,() => '22222222-2222-4222-8222-222222222222',persistence)({ ...intent,values:{ minutes:90,name:'Same name' } });
    expect(send.mock.calls[0][0].requestId).toBe(requestId);
    expect(values.size).toBe(0);
  });
});
