import { createOperationRequests } from './operationRequests';
import { supabase } from './supabase';
import type { TournamentRow } from './supabaseMap';

export type TournamentValues = Pick<TournamentRow,
  'title'|'image_url'|'address'|'start_date'|'start_time'|'total_seats'|'guarantee'|'about'|
  'features'|'late_reg_until'|'blind_structure'|'blind_structure_id'|'stack_size'|'level_duration'|
  'is_bounty'|'admin_secret_comment'>;
export type TournamentChanges = Partial<TournamentValues>;

type CreateIntent={values:TournamentValues};
type UpdateIntent={tournamentId:string;changes:TournamentChanges};
type Result={request_id:string;tournament_id:string;tournament:TournamentRow};
const createQueues=new Map<string,ReturnType<typeof createOperationRequests<CreateIntent,Result>>>();
const updateQueues=new Map<string,ReturnType<typeof createOperationRequests<UpdateIntent,Result>>>();

function persistence(actorId:string) {
  return {scope:actorId,storage:()=>window.sessionStorage};
}

function createQueue(actorId:string) {
  let current=createQueues.get(actorId); if(current)return current;
  current=createOperationRequests(async(input)=>{
    const {data,error}=await supabase.rpc('club_create_tournament',{
      p_request_id:input.requestId,p_values:input.values,
    });
    if(error)throw new Error(error.message||'Не удалось создать турнир');
    const result=data as Result|null;
    if(!result||result.request_id!==input.requestId||result.tournament_id!==result.tournament?.id)
      throw new Error('Сервер не подтвердил создание турнира');
    return result;
  },(intent)=>({values:intent.values}),'showdown.tournament.create.v1',undefined,persistence(actorId));
  createQueues.set(actorId,current); return current;
}

function updateQueue(actorId:string) {
  let current=updateQueues.get(actorId); if(current)return current;
  current=createOperationRequests(async(input)=>{
    const {data,error}=await supabase.rpc('club_update_tournament',{
      p_request_id:input.requestId,p_tournament_id:input.tournamentId,p_changes:input.changes,
    });
    if(error)throw new Error(error.message||'Не удалось изменить турнир');
    const result=data as Result|null;
    if(!result||result.request_id!==input.requestId||result.tournament_id!==input.tournamentId
      ||result.tournament?.id!==input.tournamentId)throw new Error('Сервер не подтвердил изменение турнира');
    return result;
  },(intent)=>({tournamentId:intent.tournamentId.trim(),changes:intent.changes}),
  'showdown.tournament.update.v1',undefined,persistence(actorId));
  updateQueues.set(actorId,current); return current;
}

export function createTournamentCommand(actorId:string,values:TournamentValues) {
  if(!actorId.trim())throw new Error('Не удалось подтвердить администратора');
  return createQueue(actorId)({values});
}

export function updateTournamentCommand(actorId:string,tournamentId:string,changes:TournamentChanges) {
  if(!actorId.trim())throw new Error('Не удалось подтвердить администратора');
  return updateQueue(actorId)({tournamentId,changes});
}
