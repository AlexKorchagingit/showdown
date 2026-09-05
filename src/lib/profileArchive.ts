import { createOperationRequests } from './operationRequests';
import { supabase } from './supabase';

type ArchiveIntent={userId:string;reason:string};
type ArchiveResult={request_id:string;user_id:string;archived:boolean;already_archived:boolean;archived_at:string};
const queues=new Map<string,ReturnType<typeof createOperationRequests<ArchiveIntent,ArchiveResult>>>();

export async function sendProfileArchive(input:ArchiveIntent&{requestId:string}):Promise<ArchiveResult>{
  const {data,error}=await supabase.rpc('club_archive_profile',{
    p_request_id:input.requestId,p_user_id:input.userId,p_reason:input.reason,
  });
  if(error)throw new Error(error.message||'Не удалось архивировать профиль');
  const result=data as ArchiveResult|null;
  if(!result||result.request_id!==input.requestId||result.user_id!==input.userId||result.archived!==true)
    throw new Error('Сервер не подтвердил архивирование профиля');
  return result;
}

function archiveQueue(actorId:string){
  let queue=queues.get(actorId);if(queue)return queue;
  queue=createOperationRequests(sendProfileArchive,(intent)=>({
    userId:intent.userId.trim(),reason:intent.reason.trim(),
  }),'showdown.profile-archive.v1',undefined,{scope:actorId,storage:()=>window.sessionStorage});
  queues.set(actorId,queue);return queue;
}

export function archiveUserProfile(actorId:string,userId:string,reason:string){
  if(!actorId.trim())throw new Error('Не удалось подтвердить SuperAdmin');
  if(reason.trim().length<3)throw new Error('Укажите причину архивирования');
  return archiveQueue(actorId)({userId,reason});
}
