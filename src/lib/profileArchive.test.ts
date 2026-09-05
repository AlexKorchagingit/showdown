import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{rpc:mocks.rpc}}));
import {sendProfileArchive} from './profileArchive';

const requestId='11111111-1111-4111-8111-111111111111';
const result={request_id:requestId,user_id:'member',archived:true,already_archived:false,
  archived_at:'2026-09-05T12:00:00.000Z'};

beforeEach(()=>vi.clearAllMocks());
describe('profile archival client',()=>{
  it('sends only the target, reason and retry identity',async()=>{
    mocks.rpc.mockResolvedValue({data:result,error:null});
    await sendProfileArchive({requestId,userId:'member',reason:'duplicate profile'});
    expect(mocks.rpc).toHaveBeenCalledWith('club_archive_profile',{
      p_request_id:requestId,p_user_id:'member',p_reason:'duplicate profile',
    });
  });
  it('requires an exact server confirmation',async()=>{
    mocks.rpc.mockResolvedValue({data:{...result,user_id:'other'},error:null});
    await expect(sendProfileArchive({requestId,userId:'member',reason:'duplicate profile'}))
      .rejects.toThrow('не подтвердил');
  });
});
