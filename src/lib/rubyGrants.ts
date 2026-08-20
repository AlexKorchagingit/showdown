import { mockUsers } from '../data/mockUsers';
import {
  loadUserData,
  saveUserData,
  type PendingNotification,
} from './userStorage';

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
  return mockUsers.map((user) => {
    const data = loadUserData(user.email);
    return {
      id: user.id,
      email: user.email,
      nickname: data.nickname || user.nickname,
      coins: data.coins,
      pendingAmount: data.pendingNotifications.reduce((sum, row) => sum + row.amount, 0),
    };
  });
}

/** Offline users get a claimable popup; the signed-in account is credited immediately. */
export function grantRubies(options: {
  email: string;
  amount: number;
  message: string;
  currentEmail: string;
  creditCurrentUser: (amount: number) => void;
}) {
  const amount = Math.floor(Number(options.amount));
  if (!Number.isFinite(amount) || amount <= 0) return;

  if (normalizeEmail(options.email) === normalizeEmail(options.currentEmail)) {
    options.creditCurrentUser(amount);
    return;
  }

  const data = loadUserData(options.email);
  saveUserData(options.email, {
    ...data,
    pendingNotifications: [
      ...data.pendingNotifications,
      createRubyNotification(options.message, amount),
    ],
  });
}

export function grantRubiesToEveryone(options: {
  amount: number;
  message: string;
  currentEmail: string;
  creditCurrentUser: (amount: number) => void;
}) {
  for (const user of mockUsers) {
    grantRubies({
      email: user.email,
      amount: options.amount,
      message: options.message,
      currentEmail: options.currentEmail,
      creditCurrentUser: options.creditCurrentUser,
    });
  }
}

/** Credit the ruby balance immediately (tournament payouts — no claim popup). */
export function creditRubiesToBalance(options: {
  email: string;
  amount: number;
  currentEmail: string;
  creditCurrentUser: (amount: number) => void;
}) {
  const amount = Math.floor(Number(options.amount));
  if (!Number.isFinite(amount) || amount <= 0 || !options.email.trim()) return;

  if (normalizeEmail(options.email) === normalizeEmail(options.currentEmail)) {
    options.creditCurrentUser(amount);
    return;
  }

  const data = loadUserData(options.email);
  saveUserData(options.email, { ...data, coins: data.coins + amount });
}
