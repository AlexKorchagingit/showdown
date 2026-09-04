import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('./supabase',()=>({supabase:mocks}));
import {createTournamentCommand,updateTournamentCommand,type TournamentValues} from './tournamentCommands';

const storageValues=new Map<string,string>();
const storage={getItem:(key:string)=>storageValues.get(key)??null,setItem:(key:string,value:string)=>storageValues.set(key,value),
  removeItem:(key:string)=>storageValues.delete(key)};
const values:TournamentValues={title:'Event',image_url:'',address:'Club',start_date:'2026-10-05',start_time:'19:00',
  total_seats:27,guarantee:20000,about:'',features:[],late_reg_until:'22:45',blind_structure:'Smooth',
  blind_structure_id:null,stack_size:50000,level_duration:'20 мин',is_bounty:false,admin_secret_comment:null};
const row={id:'server-event',...values,is_closed:false,results_entered:false,rubies_distributed:false,staff:[],dealers:[]};

beforeEach(()=>{mocks.rpc.mockReset();storageValues.clear();Object.defineProperty(globalThis,'window',{
  value:{sessionStorage:storage},configurable:true});});

describe('protected tournament command client',()=>{
  it('sends only server command arguments and accepts the server-owned id',async()=>{
    mocks.rpc.mockImplementation(async(name:string,args:{p_request_id:string})=>({data:{request_id:args.p_request_id,
      tournament_id:row.id,tournament:row},error:null}));
    const result=await createTournamentCommand('verified-admin',values);
    expect(result.tournament_id).toBe('server-event');expect(mocks.rpc).toHaveBeenCalledTimes(1);
    const [name,args]=mocks.rpc.mock.calls[0];expect(name).toBe('club_create_tournament');
    expect(args).toEqual({p_request_id:expect.any(String),p_values:values});
    expect(args).not.toHaveProperty('actor_id');expect(storageValues.size).toBe(0);
  });

  it('sends a narrow patch and rejects a wrong-target confirmation',async()=>{
    mocks.rpc.mockImplementation(async(_name:string,args:{p_request_id:string})=>({data:{request_id:args.p_request_id,
      tournament_id:'other',tournament:{...row,id:'other'}},error:null}));
    await expect(updateTournamentCommand('verified-admin-2','server-event',{title:'Renamed'})).rejects.toThrow('не подтвердил');
    expect(mocks.rpc).toHaveBeenCalledWith('club_update_tournament',{p_request_id:expect.any(String),
      p_tournament_id:'server-event',p_changes:{title:'Renamed'}});
  });

  it('refuses to send without a verified administrator identity',()=>{
    expect(()=>createTournamentCommand('',values)).toThrow('администратора');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
