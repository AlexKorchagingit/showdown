import { fetchClubUsers, fetchUserByEmail, updateUserRow } from './userApi';
import { getClubDirectory } from './clubDirectory';
import type { PendingNotification } from './userStorage';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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

  if (normalizeEmail(options.email) === normalizeEmail(options.currentEmail)) {
    await options.creditCurrentUser(amount);
    return;
  }

  const user = await fetchUserByEmail(options.email);
  if (!user) return;
  await updateUserRow(user.id, {
    pending_notifications: [
      ...user.pendingNotifications,
      createRubyNotification(options.message, amount),
    ],
  });
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

  if (normalizeEmail(options.email) === normalizeEmail(options.currentEmail)) {
    await options.creditCurrentUser(amount);
    return;
  }

  const user = await fetchUserByEmail(options.email);
  if (!user) return;
  await updateUserRow(user.id, { ruby_balance: Math.max(0, user.coins + amount) });
}
