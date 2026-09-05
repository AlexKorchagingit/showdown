import { createOperationRequests } from './operationRequests';
import { supabase } from './supabase';

export type ParticipantCommandRow={source_id:string|null;seat_id:string;user_id:string|null;nickname:string;
  place:number|null;knockouts:number;comment:string|null;arrived:boolean};
type Intent={tournamentId:string;rows:ParticipantCommandRow[]};
type Result={request_id:string;tournament_id:string;participants:number};
const queues=new Map<string,ReturnType<typeof createOperationRequests<Intent,Result>>>();

function queue(actorId:string) {
  let current=queues.get(actorId); if(current)return current;
  current=createOperationRequests(async(input)=>{
    const {data,error}=await supabase.rpc('club_replace_participants',{p_request_id:input.requestId,
      p_tournament_id:input.tournamentId,p_rows:input.rows});
    if(error)throw new Error(error.message||'Не удалось сохранить состав');
    const result=data as Result|null;
    if(!result||result.request_id!==input.requestId||result.tournament_id!==input.tournamentId)
      throw new Error('Сервер не подтвердил состав турнира');
    return result;
  },(intent)=>({tournamentId:intent.tournamentId.trim(),rows:[...intent.rows].sort((a,b)=>a.seat_id.localeCompare(b.seat_id))}),
  'showdown.participants.v2',undefined,{scope:actorId,storage:()=>window.sessionStorage});
  queues.set(actorId,current); return current;
}
export function replaceParticipants(actorId:string,tournamentId:string,rows:ParticipantCommandRow[]) {
  if(!actorId.trim())throw new Error('Не удалось подтвердить администратора');
  return queue(actorId)({tournamentId,rows});
}
