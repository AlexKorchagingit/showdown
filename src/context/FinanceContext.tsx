import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  deleteTransactionRow,
  fetchTransactions,
  insertTransaction,
  updateDealerHoursRows,
  updateTransactions,
} from '../lib/financeApi';
import {
  DEFAULT_ENTRY_FEE,
  type Transaction,
  type TransactionType,
} from '../types/finance';
import { sanitizeParticipantUserId } from '../lib/supabaseMap';

function dealerKey(tournamentId: string, userId: string) {
  return `${tournamentId}:${userId}`;
}

function resolveLedgerUserId(userId: string): string | null {
  return sanitizeParticipantUserId(userId);
}

interface FinanceContextValue {
  transactions: Transaction[];
  isLoading: boolean;
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
  removeTransaction: (transactionId: string) => Promise<boolean>;
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dealerHoursMap, setDealerHoursMap] = useState<Record<string, number>>({});
  const [dealerLoggedAtMap, setDealerLoggedAtMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      try {
        const rows = await fetchTransactions();
        if (cancelled) return;
        setTransactions(rows);
        setDealerHoursMap(seedDealerHours(rows));
      } catch (error) {
        console.error(error);
        if (!cancelled) setTransactions([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const getDealerHours = useCallback(
    (tournamentId: string, userId: string) => dealerHoursMap[dealerKey(tournamentId, userId)] ?? 0,
    [dealerHoursMap],
  );

  const getDealerLoggedAt = useCallback(
    (tournamentId: string, userId: string) => dealerLoggedAtMap[dealerKey(tournamentId, userId)],
    [dealerLoggedAtMap],
  );

  const adjustDealerHours = useCallback((tournamentId: string, userId: string, delta: number) => {
    const ledgerUserId = resolveLedgerUserId(userId);
    if (!ledgerUserId) return;
    const key = dealerKey(tournamentId, ledgerUserId);
    const stamped = new Date().toISOString();
    setDealerLoggedAtMap((prev) => ({ ...prev, [key]: stamped }));
    setDealerHoursMap((prev) => {
      const nextHours = Math.max(0, Math.round(((prev[key] ?? 0) + delta) * 10) / 10);
      void updateDealerHoursRows(tournamentId, ledgerUserId, nextHours).catch((error) => {
        console.error(error);
        window.alert(error instanceof Error ? error.message : 'Не удалось сохранить часы дилера');
      });
      setTransactions((txs) =>
        txs.map((tx) =>
          tx.tournamentId === tournamentId && tx.userId === ledgerUserId
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
      const ledgerUserId = resolveLedgerUserId(userId);
      if (!ledgerUserId) {
        window.alert('Нельзя выставить счёт: игрок не найден в базе пользователей');
        return;
      }
      const hours = dealerHoursMap[dealerKey(tournamentId, ledgerUserId)] ?? 0;
      const tx: Transaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: new Date().toISOString(),
        tournamentId,
        userId: ledgerUserId,
        type,
        amount: DEFAULT_ENTRY_FEE,
        status: 'unpaid',
        comment: '',
        isDealer: hours > 0,
        dealerHours: hours,
      };
      void insertTransaction(tx)
        .then((saved) => {
          setTransactions((prev) => [saved, ...prev]);
        })
        .catch((error) => {
          console.error(error);
          window.alert(error instanceof Error ? error.message : 'Не удалось создать транзакцию');
        });
    },
    [dealerHoursMap],
  );

  const addTicket = useCallback(
    (tournamentId: string, userId: string, comment: string) => {
      const ledgerUserId = resolveLedgerUserId(userId);
      if (!ledgerUserId) {
        window.alert('Нельзя выдать билет: игрок не найден в базе пользователей');
        return;
      }
      const hours = dealerHoursMap[dealerKey(tournamentId, ledgerUserId)] ?? 0;
      const tx: Transaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: new Date().toISOString(),
        tournamentId,
        userId: ledgerUserId,
        type: 'ticket',
        amount: 0,
        status: 'paid',
        comment: comment.trim(),
        isDealer: hours > 0,
        dealerHours: hours,
      };
      void insertTransaction(tx)
        .then((saved) => {
          setTransactions((prev) => [saved, ...prev]);
        })
        .catch((error) => {
          console.error(error);
          window.alert(error instanceof Error ? error.message : 'Не удалось создать билет');
        });
    },
    [dealerHoursMap],
  );

  const markPaid = useCallback((transactionIds: string[]) => {
    if (transactionIds.length === 0) return;
    const idSet = new Set(transactionIds);
    const paidAt = new Date().toISOString();
    void updateTransactions(transactionIds, { status: 'paid', updated_at: paidAt })
      .then(() => {
        setTransactions((prev) =>
          prev.map((tx) =>
            idSet.has(tx.id) ? { ...tx, status: 'paid' as const, updatedAt: paidAt } : tx,
          ),
        );
      })
      .catch((error) => {
        console.error(error);
        window.alert(error instanceof Error ? error.message : 'Не удалось отметить оплату');
      });
  }, []);

  const removeTransaction = useCallback(async (transactionId: string): Promise<boolean> => {
    try {
      await deleteTransactionRow(transactionId);
      setTransactions((prev) => prev.filter((tx) => tx.id !== transactionId));
      return true;
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : 'Не удалось удалить транзакцию');
      return false;
    }
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
      isLoading,
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
      isLoading,
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
