import { fetchClubUsers, fetchUserByEmail } from './userApi';
import { supabase } from './supabase';
import { createOperationRequests } from './operationRequests';
import { getClubDirectory } from './clubDirectory';
import type { PendingNotification } from './userStorage';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

type GrantIntent={userId:string;amount:number;message:string;delivery:'notification'|'immediate'};
const queues=new Map<string,ReturnType<typeof createOperationRequests<GrantIntent,void>>>();
function grantQueue(scope:string) {
  let queue=queues.get(scope);
  if(queue)return queue;
  queue=createOperationRequests(async(input)=>{
    const {data,error}=await supabase.rpc('club_grant_rubies',{p_request_id:input.requestId,p_user_id:input.userId,
      p_amount:input.amount,p_message:input.message,p_delivery:input.delivery});
    if(error||data?.request_id!==input.requestId||data?.user_id!==input.userId) throw new Error('Не удалось подтвердить начисление рубинов');
  },(value)=>({...value,message:value.message.trim()||'Подарок от клуба'}),'showdown.ruby-grant.v1',undefined,
    {scope,storage:()=>window.sessionStorage});
  queues.set(scope,queue); return queue;
}

export function createRubyNotification(message: string, amount: number): PendingNotification {
  return {
    id: `ruby-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: message.trim() || 'Подарок от клуба',
    amount,
  };
}

export type RubyAccount = {
  id: string;
  email: string;
  nickname: string;
  coins: number;
  pendingAmount: number;
};

export function readRubyAccounts(): RubyAccount[] {
  return getClubDirectory().map((user) => ({
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    coins: user.coins,
    pendingAmount: user.pendingNotifications.reduce((sum, row) => sum + row.amount, 0),
  }));
}

/** Offline users get a claimable popup; the signed-in account is credited immediately. */
export async function grantRubies(options: {
  email: string;
  amount: number;
  message: string;
  currentEmail: string;
  creditCurrentUser: (amount: number) => void | Promise<void>;
}) {
  const amount = Math.floor(Number(options.amount));
  if (!Number.isFinite(amount) || amount <= 0) return;

  const user = await fetchUserByEmail(options.email);
  if (!user) return;
  await grantQueue(normalizeEmail(options.currentEmail))({userId:user.id,amount,message:options.message,
    delivery:normalizeEmail(options.email)===normalizeEmail(options.currentEmail)?'immediate':'notification'});
  if(normalizeEmail(options.email)===normalizeEmail(options.currentEmail)) await options.creditCurrentUser(0);
}

export async function grantRubiesToEveryone(options: {
  amount: number;
  message: string;
  currentEmail: string;
  creditCurrentUser: (amount: number) => void | Promise<void>;
}) {
  const users = await fetchClubUsers();
  for (const user of users) {
    await grantRubies({
      email: user.email,
      amount: options.amount,
      message: options.message,
      currentEmail: options.currentEmail,
      creditCurrentUser: options.creditCurrentUser,
    });
  }
}

/** Credit the ruby balance immediately (tournament payouts — no claim popup). */
export async function creditRubiesToBalance(options: {
  email: string;
  amount: number;
  currentEmail: string;
  creditCurrentUser: (amount: number) => void | Promise<void>;
}) {
  const amount = Math.floor(Number(options.amount));
  if (!Number.isFinite(amount) || amount <= 0 || !options.email.trim()) return;

  const user = await fetchUserByEmail(options.email);
  if (!user) return;
  await grantQueue(normalizeEmail(options.currentEmail))({userId:user.id,amount,message:'Выплата за турнир',delivery:'immediate'});
  if(normalizeEmail(options.email)===normalizeEmail(options.currentEmail)) await options.creditCurrentUser(0);
}
