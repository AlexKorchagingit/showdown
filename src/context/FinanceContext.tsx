import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { MOCK_TRANSACTIONS } from '../data/finance';
import {
  DEFAULT_ENTRY_FEE,
  type Transaction,
  type TransactionType,
} from '../types/finance';

function dealerKey(tournamentId: string, userId: string) {
  return `${tournamentId}:${userId}`;
}

interface FinanceContextValue {
  transactions: Transaction[];
  getDealerHours: (tournamentId: string, userId: string) => number;
  getDealerLoggedAt: (tournamentId: string, userId: string) => string | undefined;
  adjustDealerHours: (tournamentId: string, userId: string, delta: number) => void;
  addCharge: (
    tournamentId: string,
    userId: string,
    type: Exclude<TransactionType, 'ticket'>,
  ) => void;
  addTicket: (tournamentId: string, userId: string, comment: string) => void;
  markPaid: (transactionIds: string[]) => void;
  removeTransaction: (transactionId: string) => void;
  markPlayerPaid: (tournamentId: string, userId: string) => void;
  markAllUnpaidForPlayer: (userId: string) => void;
  unpaidForPlayer: (tournamentId: string, userId: string) => Transaction[];
  unpaidTotalForPlayer: (tournamentId: string, userId: string) => number;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

function seedDealerHours(txs: Transaction[]): Record<string, number> {
  const map: Record<string, number> = {};
  txs.forEach((tx) => {
    const key = dealerKey(tx.tournamentId, tx.userId);
    map[key] = Math.max(map[key] ?? 0, tx.dealerHours);
  });
  return map;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [dealerHoursMap, setDealerHoursMap] = useState<Record<string, number>>(() =>
    seedDealerHours(MOCK_TRANSACTIONS),
  );
  const [dealerLoggedAtMap, setDealerLoggedAtMap] = useState<Record<string, string>>({});

  const getDealerHours = useCallback(
    (tournamentId: string, userId: string) => dealerHoursMap[dealerKey(tournamentId, userId)] ?? 0,
    [dealerHoursMap],
  );

  const getDealerLoggedAt = useCallback(
    (tournamentId: string, userId: string) => dealerLoggedAtMap[dealerKey(tournamentId, userId)],
    [dealerLoggedAtMap],
  );

  const adjustDealerHours = useCallback((tournamentId: string, userId: string, delta: number) => {
    const key = dealerKey(tournamentId, userId);
    const stamped = new Date().toISOString();
    setDealerLoggedAtMap((prev) => ({ ...prev, [key]: stamped }));
    setDealerHoursMap((prev) => {
      const nextHours = Math.max(0, Math.round(((prev[key] ?? 0) + delta) * 10) / 10);
      setTransactions((txs) =>
        txs.map((tx) =>
          tx.tournamentId === tournamentId && tx.userId === userId
            ? { ...tx, dealerHours: nextHours, isDealer: nextHours > 0 }
            : tx,
        ),
      );
      return { ...prev, [key]: nextHours };
    });
  }, []);

  const addCharge = useCallback(
    (
      tournamentId: string,
      userId: string,
      type: Exclude<TransactionType, 'ticket'>,
    ) => {
      const hours = dealerHoursMap[dealerKey(tournamentId, userId)] ?? 0;
      const tx: Transaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: new Date().toISOString(),
        tournamentId,
        userId,
        type,
        amount: DEFAULT_ENTRY_FEE,
        status: 'unpaid',
        comment: '',
        isDealer: hours > 0,
        dealerHours: hours,
      };
      setTransactions((prev) => [tx, ...prev]);
    },
    [dealerHoursMap],
  );

  const addTicket = useCallback(
    (tournamentId: string, userId: string, comment: string) => {
      const hours = dealerHoursMap[dealerKey(tournamentId, userId)] ?? 0;
      const tx: Transaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: new Date().toISOString(),
        tournamentId,
        userId,
        type: 'ticket',
        amount: 0,
        status: 'paid',
        comment: comment.trim(),
        isDealer: hours > 0,
        dealerHours: hours,
      };
      setTransactions((prev) => [tx, ...prev]);
    },
    [dealerHoursMap],
  );

  const markPaid = useCallback((transactionIds: string[]) => {
    const idSet = new Set(transactionIds);
    const paidAt = new Date().toISOString();
    setTransactions((prev) =>
      prev.map((tx) =>
        idSet.has(tx.id) ? { ...tx, status: 'paid' as const, updatedAt: paidAt } : tx,
      ),
    );
  }, []);

  const removeTransaction = useCallback((transactionId: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== transactionId));
  }, []);

  const unpaidForPlayer = useCallback(
    (tournamentId: string, userId: string) =>
      transactions.filter(
        (tx) =>
          tx.tournamentId === tournamentId &&
          tx.userId === userId &&
          tx.status === 'unpaid',
      ),
    [transactions],
  );

  const unpaidTotalForPlayer = useCallback(
    (tournamentId: string, userId: string) =>
      unpaidForPlayer(tournamentId, userId).reduce((sum, tx) => sum + tx.amount, 0),
    [unpaidForPlayer],
  );

  const markPlayerPaid = useCallback(
    (tournamentId: string, userId: string) => {
      const ids = unpaidForPlayer(tournamentId, userId).map((tx) => tx.id);
      if (ids.length) markPaid(ids);
    },
    [unpaidForPlayer, markPaid],
  );

  const markAllUnpaidForPlayer = useCallback(
    (userId: string) => {
      const ids = transactions
        .filter((tx) => tx.userId === userId && tx.status === 'unpaid')
        .map((tx) => tx.id);
      if (ids.length) markPaid(ids);
    },
    [transactions, markPaid],
  );

  const value = useMemo(
    () => ({
      transactions,
      getDealerHours,
      getDealerLoggedAt,
      adjustDealerHours,
      addCharge,
      addTicket,
      markPaid,
      removeTransaction,
      markPlayerPaid,
      markAllUnpaidForPlayer,
      unpaidForPlayer,
      unpaidTotalForPlayer,
    }),
    [
      transactions,
      getDealerHours,
      getDealerLoggedAt,
      adjustDealerHours,
      addCharge,
      addTicket,
      markPaid,
      removeTransaction,
      markPlayerPaid,
      markAllUnpaidForPlayer,
      unpaidForPlayer,
      unpaidTotalForPlayer,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
