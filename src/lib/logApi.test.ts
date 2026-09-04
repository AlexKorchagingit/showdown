import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),log:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{rpc:mocks.rpc,from:mocks.from},logSupabaseError:mocks.log}));
import {fetchLogs} from './logApi';

const row={id:'log-1',timestamp:'2026-09-05T12:00:00.000Z',admin_id:'admin',admin_email:'admin@example.test',
  admin_name:'Admin',action_type:'Changed tournament',target_user_id:null,target_user_email:null,
  target_user_name:null,target_tournament_id:'event',target_tournament_name:'Event',details:'Safe'};

beforeEach(()=>vi.clearAllMocks());

describe('protected audit client',()=>{
  it('reads only through the SuperAdmin projection',async()=>{
    mocks.rpc.mockResolvedValue({data:[row],error:null});
    expect(await fetchLogs()).toMatchObject([{id:'log-1',actionType:'Changed tournament'}]);
    expect(mocks.rpc).toHaveBeenCalledWith('club_audit_snapshot');expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rejects malformed snapshots instead of silently hiding audit rows',async()=>{
    mocks.rpc.mockResolvedValue({data:[row,{id:'broken'}],error:null});
    await expect(fetchLogs()).rejects.toThrow('повреждённую');
  });

  it('does not expose provider diagnostics to the screen',async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{message:'private database diagnostic'}});
    await expect(fetchLogs()).rejects.toThrow('Не удалось загрузить журнал');
    await expect(fetchLogs()).rejects.not.toThrow('private database diagnostic');
  });
});
