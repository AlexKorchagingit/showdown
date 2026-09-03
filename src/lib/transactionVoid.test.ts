import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc:vi.fn(),from:vi.fn() }));
vi.mock('./supabase',()=>({supabase:mocks}));
import { markTransactionsPaid, voidTransactionOnServer } from './financeApi';
import { isActiveTransaction, mergeTransactionUpdates, reconcileTransactionSnapshot, transactionVoidPrompt } from './transactionVoid';
import { csvEscape, financeExportRows } from './exportToCSV';
import { computeClubStatistics } from './clubStatistics';
import { computePlayerAdminStats, hasGlobalUnpaidDebt } from './playerAnalytics';
import type { Transaction } from '../types/finance';
import type { Tournament } from '../types/tournament';

const tx: Transaction = {id:'test-tx',date:'2026-09-03T10:00:00Z',userId:'user',tournamentId:'event',
  type:'buy-in',amount:1000,status:'unpaid',comment:'',isDealer:false,dealerHours:0};
const paid = {...tx,status:'paid' as const,updatedAt:'2026-09-03T11:00:00Z'};
const cancelled = {...paid,voidedAt:'2026-09-03T12:00:00Z',voidReason:'Duplicate'};
const row = {id:tx.id,user_id:'user',tournament_id:'event',date:tx.date,type:'buy-in',amount:1000,
  status:'paid',comment:'',is_dealer:false,dealer_hours:0,updated_at:paid.updatedAt,
  voided_at:cancelled.voidedAt,void_reason:'Duplicate'};
beforeEach(()=>vi.clearAllMocks());

describe('non-destructive financial cancellation',()=>{
  it('passes only the transaction and reason and never calls table deletion',async()=>{
    mocks.rpc.mockResolvedValue({data:row,error:null});
    expect(await voidTransactionOnServer(tx.id,'  Duplicate  ')).toEqual(cancelled);
    expect(mocks.rpc).toHaveBeenCalledWith('club_void_transaction',{p_transaction_id:tx.id,p_reason:'Duplicate'});
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('requires a bounded reason before sending anything',async()=>{
    for (const reason of ['','   ','x'.repeat(1001)]) await expect(voidTransactionOnServer(tx.id,reason)).rejects.toThrow('причину');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('fails closed on an error or an unconfirmed cancellation',async()=>{
    for (const data of [null,{...row,id:'other'},{...row,voided_at:null},{...row,voided_at:'bad date'}]) {
      mocks.rpc.mockResolvedValue({data,error:null});
      await expect(voidTransactionOnServer(tx.id,'Duplicate')).rejects.toThrow('не подтвердил');
    }
    mocks.rpc.mockResolvedValue({data:null,error:{message:'private provider error'}});
    await expect(voidTransactionOnServer(tx.id,'Duplicate')).rejects.not.toThrow('private provider error');
  });
  it('rejects a cancelled row returned as a successful payment',async()=>{
    mocks.rpc.mockResolvedValue({data:[row],error:null});
    await expect(markTransactionsPaid([tx.id])).rejects.toThrow('не подтвердил');
  });
  it('keeps cancellation through late creation/payment replies without duplicating rows',()=>{
    expect(mergeTransactionUpdates([cancelled],[tx,paid])).toEqual([cancelled]);
    expect(mergeTransactionUpdates([paid],[tx])).toEqual([paid]);
    expect(isActiveTransaction(cancelled)).toBe(false);
    expect(isActiveTransaction(tx)).toBe(true);
  });
  it('keeps terminal state in snapshots but drops entries outside the new authorized scope',()=>{
    expect(reconcileTransactionSnapshot([cancelled],[tx])).toEqual([cancelled]);
    expect(reconcileTransactionSnapshot([cancelled],[])).toEqual([]);
    expect(reconcileTransactionSnapshot([cancelled],[{...cancelled,voidReason:undefined}])[0].voidReason).toBeUndefined();
  });
  it('excludes cancellations from debts, club totals and player statistics',()=>{
    const tournament: Tournament = {id:'event',title:'Test',startDate:'2026-09-03',startTime:'19:00',isClosed:false,
      imageUrl:'',address:'Test',totalSeats:27,about:'',lateRegUntil:'21:00',blindStructure:'Test',
      stackSize:30000,levelDuration:'15',guarantee:0,features:[],
      participants:[{id:'user',userId:'user',nickname:'Test',rating:0}]};
    const ledger = [paid,{...tx,id:'unpaid'}, {...cancelled,id:'cancelled-paid',type:'rebuy' as const},
      {...cancelled,id:'cancelled-unpaid',status:'unpaid' as const,amount:7000,type:'addon' as const}];
    expect(hasGlobalUnpaidDebt([ledger[3]],'user')).toBe(false);
    const stats = computeClubStatistics([tournament],ledger,[{id:'user',nickname:'Test'}]);
    expect(ledger.filter(isActiveTransaction).filter((entry)=>entry.status==='paid').reduce((sum,entry)=>sum+entry.amount,0)).toBe(1000);
    expect(stats.averageCheck).toBe(500);
    expect(stats.rebuyCount).toBe(0);
    expect(stats.addonCount).toBe(0);
    expect(stats.debtorPercent).toBe(50);
    expect(stats.biggestCheck.amount).toBe(2000);
    const player = computePlayerAdminStats('user','Test',[tournament],ledger,()=>0);
    expect(player.ltv).toBe(1000);
    expect(player.clubDebt).toBe(1000);
    expect(player.avgRebuys).toBe(0);
  });
  it('exports original facts and cancellation fields separately and warns that no refund occurs',()=>{
    const result = financeExportRows([cancelled],{playerName:()=> 'Test',tournamentTitle:()=> 'Event'});
    expect(result.rows[0][5]).toBe(1000);
    expect(result.rows[0][6]).toBe('Оплачено');
    expect(result.rows[0][8]).toBe(true);
    expect(result.rows[0][10]).toBe('Duplicate');
    expect(transactionVoidPrompt(paid)).toContain('НЕ возврат денег');
    expect(transactionVoidPrompt(tx)).toContain('сохранится в истории');
  });
  it('treats formula-like exported reasons as text while preserving actual numeric values',()=>{
    expect(csvEscape('=1+1')).toBe("'=1+1");
    expect(csvEscape('  @SUM(A1)')).toBe("'  @SUM(A1)");
    expect(csvEscape('-1000')).toBe("'-1000");
    expect(csvEscape(-1000)).toBe('-1000');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('Reason')).toBe('Reason');
  });
});
