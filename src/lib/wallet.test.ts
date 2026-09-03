import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn()}));
vi.mock('./supabase',()=>({supabase:mocks,logSupabaseError:vi.fn()}));
import { claimRubyNotification, createShopRequests, fetchWallet, mergeWallet, parseWallet, sendShopCommand, shopCatalogItems, type ShopIntent } from './wallet';
import { mappedUserToPatch, updateUserRow } from './userApi';
const raw={user_id:'user',revision:2,ruby_balance:0,owned_items:['legacy-art','char_base','bg_base'],
  equipped_char:'char_base',equipped_bg:'bg_base',pending_notifications:[{id:'bonus',message:'Gift',amount:500}],
  catalog:[{id:'char_base',type:'character',name:'Base',price:0,active:true,revision:1},
    {id:'char_jester',type:'character',name:'Server jester',price:3500,active:true,revision:2}]};
const saved=parseWallet(raw,'user');
const requestId='11111111-1111-4111-8111-111111111111';
const intent: ShopIntent={action:'buy',itemId:'char_jester',catalogRevision:2};
beforeEach(()=>vi.clearAllMocks());

describe('server-authoritative shop and wallet',()=>{
  it('loads own wallet without sending a client identity and preserves zero balance and legacy inventory',async()=>{
    mocks.rpc.mockResolvedValue({data:raw,error:null});
    expect(await fetchWallet('user')).toEqual(saved);
    expect(mocks.rpc).toHaveBeenCalledWith('club_wallet_snapshot');
    expect(saved.coins).toBe(0);
    expect(saved.ownedItems).toContain('legacy-art');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('refuses another account and invalid balance/revisions/inventory without defaults or resets',()=>{
    for(const row of [null,{...raw,user_id:'other'},{...raw,ruby_balance:-1},{...raw,ruby_balance:1.5},
      {...raw,ruby_balance:2147483648},{...raw,revision:NaN},{...raw,owned_items:null}]) {
      expect(()=>parseWallet(row,'user')).toThrow();
    }
  });
  it('does not silently drop invalid bonus records or duplicate notification IDs',()=>{
    const n=raw.pending_notifications[0];
    for(const pending_notifications of [[n,n],[{...n,amount:-1}],[{...n,amount:0.5}],[{...n,amount:'100'}],[{...n,id:''}]]) {
      expect(()=>parseWallet({...raw,pending_notifications},'user')).toThrow();
    }
    for(const catalog of [[...raw.catalog,raw.catalog[0]],[{...raw.catalog[0],price:-1}],[{...raw.catalog[0],revision:0}]]) {
      expect(()=>parseWallet({...raw,catalog},'user')).toThrow();
    }
  });
  it('sends only item, request ID and catalog revision, never a price, balance, owner or timestamp',async()=>{
    mocks.rpc.mockResolvedValue({data:{request_id:requestId,wallet:raw},error:null});
    const input={...intent,requestId,price:1,balance:99999,userId:'other',date:'2000-01-01'};
    expect(await sendShopCommand('user',input)).toEqual(saved);
    expect(mocks.rpc).toHaveBeenCalledWith('club_buy_item',{
      p_request_id:requestId,p_item_id:'char_jester',p_catalog_revision:2,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('uses a separate equipment command without writing inventory or the other appearance slot',async()=>{
    mocks.rpc.mockResolvedValue({data:{request_id:requestId,wallet:raw},error:null});
    await sendShopCommand('user',{action:'equip',itemId:'char_base',requestId});
    expect(mocks.rpc).toHaveBeenCalledWith('club_equip_item',{p_request_id:requestId,p_item_id:'char_base'});
  });
  it('requires matching operation confirmation and keeps provider details out of errors',async()=>{
    for(const data of [raw,{request_id:'other',wallet:raw},{request_id:requestId,wallet:{...raw,user_id:'other'}}]) {
      mocks.rpc.mockResolvedValue({data,error:null});
      await expect(sendShopCommand('user',{...intent,requestId})).rejects.toThrow('не подтвердил');
    }
    for(const [code,expected] of [['PT402','Недостаточно'],['PT409','изменились'],['42501','Не удалось']]) {
      mocks.rpc.mockResolvedValue({data:null,error:{code,message:'private provider diagnostic'}});
      await expect(sendShopCommand('user',{...intent,requestId})).rejects.toThrow(expected);
    }
  });
  it('claims by notification ID only, never by amount or replacement notification list',async()=>{
    mocks.rpc.mockResolvedValue({data:{notification_id:'bonus',wallet:{...raw,pending_notifications:[],ruby_balance:500}},error:null});
    expect((await claimRubyNotification('user','bonus')).coins).toBe(500);
    expect(mocks.rpc).toHaveBeenCalledWith('club_claim_ruby_notification',{p_notification_id:'bonus'});
    mocks.rpc.mockResolvedValue({data:{notification_id:'wrong',wallet:raw},error:null});
    await expect(claimRubyNotification('user','bonus')).rejects.toThrow('не подтвердил');
  });
  it('merges wallet and catalog revisions independently so late replies cannot undo credits, debits or prices',()=>{
    const current={...saved,revision:5,coins:500,ownedItems:[...saved.ownedItems,'char_jester']};
    const delayed={...saved,revision:4,coins:4000,catalog:saved.catalog.map((item)=>({...item,revision:3,price:6000}))};
    const merged=mergeWallet(current,delayed);
    expect(merged.coins).toBe(500);
    expect(merged.ownedItems).toContain('char_jester');
    expect(merged.catalog[1].price).toBe(6000);
    const later=mergeWallet(merged,{...saved,revision:6,coins:1500});
    expect(later.coins).toBe(1500);
    expect(later.catalog[1].price).toBe(6000);
    expect(mergeWallet(current,{...saved,userId:'other'}).userId).toBe('other');
  });
  it('uses server prices and availability for known art without inventing images for unknown IDs',()=>{
    expect(shopCatalogItems({...saved,catalog:[...saved.catalog].reverse()}).map((item)=>item.id)).toEqual(['char_base','char_jester']);
    expect(shopCatalogItems(saved).find((item)=>item.id==='char_jester')?.price).toBe(3500);
    expect(shopCatalogItems({...saved,catalog:[{...saved.catalog[1],active:false}]})).toEqual([]);
    expect(shopCatalogItems({...saved,ownedItems:['char_jester'],catalog:[{...saved.catalog[1],active:false}]})).toHaveLength(1);
    expect(shopCatalogItems({...saved,catalog:[{...saved.catalog[1],id:'future-art'}]})).toEqual([]);
  });
  it('rejects generic inventory/appearance writes before any table request while leaving ordinary profile fields intact',async()=>{
    for(const patch of [{owned_items:['char_king']},{equipped_char:'char_king'},{equipped_bg:'bg_5'},{equipped_avatar:['forged']}]) {
      await expect(updateUserRow('user',patch)).rejects.toThrow('серверной командой');
    }
    expect(()=>mappedUserToPatch({ownedItems:['char_king']})).toThrow();
    expect(()=>mappedUserToPatch({equippedChar:'char_king'})).toThrow();
    expect(mappedUserToPatch({nickname:'Test',slogan:'Note'})).toEqual({nickname:'Test',slogan:'Note'});
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('reuses a persisted ID after a lost shop response, isolated by confirmed account and action',async()=>{
    const values=new Map<string,string>();
    const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
    const persistence={scope:'user',storage:()=>storage};
    const offline=vi.fn().mockRejectedValue(new Error('lost response'));
    await expect(createShopRequests('user',()=>requestId,persistence,offline)(intent)).rejects.toThrow();
    expect([...values.keys()][0]).toMatch(/^showdown\.shop\.v1\.[0-9a-f]{64}$/);
    expect([...values.values()]).toEqual([requestId]);
    const send=vi.fn().mockResolvedValue(saved);
    const nextId='22222222-2222-4222-8222-222222222222';
    await createShopRequests('other',()=>nextId,{...persistence,scope:'other'},send)(intent);
    expect(send.mock.calls[0][0].requestId).toBe(nextId);
    await createShopRequests('user',()=>nextId,persistence,send)(intent);
    expect(send.mock.calls[1][0].requestId).toBe(requestId);
    expect(values.size).toBe(0);
  });
});
