import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  deleteTransactionRow,
  fetchTransactions,
  createCharge,
  updateDealerHoursRows,
  markTransactionsPaid,
} from '../lib/financeApi';
import {
  type Transaction,
  type TransactionType,
} from '../types/finance';
import { sanitizeParticipantUserId } from '../lib/supabaseMap';
import { createChargeRequests } from '../lib/chargeRequests';

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
  const chargeRequests = useRef<ReturnType<typeof createChargeRequests> | null>(null);
  if (!chargeRequests.current) chargeRequests.current = createChargeRequests(createCharge);

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

  const submitCharge = useCallback(
    (tournamentId: string, userId: string, type: TransactionType, comment = '') => {
      const ledgerUserId = resolveLedgerUserId(userId);
      if (!ledgerUserId) {
        window.alert('Нельзя выставить счёт: игрок не найден в базе пользователей');
        return;
      }
      void chargeRequests.current!({ tournamentId, userId: ledgerUserId, type, comment })
        .then((saved) => {
          setTransactions((prev) => [saved, ...prev.filter((tx) => tx.id !== saved.id)]);
        })
        .catch((error) => {
          window.alert(error instanceof Error ? error.message : 'Не удалось подтвердить создание счёта');
        });
    }, [],
  );

  const addCharge = useCallback(
    (tournamentId: string, userId: string, type: Exclude<TransactionType, 'ticket'>) => {
      submitCharge(tournamentId, userId, type);
    }, [submitCharge],
  );

  const addTicket = useCallback(
    (tournamentId: string, userId: string, comment: string) => {
      submitCharge(tournamentId, userId, 'ticket', comment);
    }, [submitCharge],
  );

  const markPaid = useCallback((transactionIds: string[]) => {
    if (transactionIds.length === 0) return;
    void markTransactionsPaid(transactionIds)
      .then((saved) => {
        const confirmed = new Map(saved.map((tx) => [tx.id, tx]));
        setTransactions((prev) => prev.map((tx) => confirmed.get(tx.id) ?? tx));
      })
      .catch((error) => {
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
