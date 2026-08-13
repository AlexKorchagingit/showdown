export type TransactionType = 'buy-in' | 'rebuy' | 'addon' | 'ticket';
export type TransactionStatus = 'paid' | 'unpaid';

export interface Transaction {
  id: string;
  date: string; // ISO datetime
  tournamentId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  comment: string;
  isDealer: boolean;
  dealerHours: number;
}

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  'buy-in': 'Вход',
  rebuy: 'Ребай',
  addon: 'Аддон',
  ticket: 'Билет',
};

export const TRANSACTION_STATUS_LABEL: Record<TransactionStatus, string> = {
  paid: 'Оплачено',
  unpaid: 'Не оплачено',
};

/** Fixed cash amount for buy-in / rebuy / addon charges. */
export const DEFAULT_ENTRY_FEE = 1000;
