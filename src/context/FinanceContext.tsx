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
  fetchFinanceSnapshot,
  createCharge,
  adjustDealerHoursOnServer,
  markTransactionsPaid,
} from '../lib/financeApi';
import {
  type Transaction,
  type TransactionType,
} from '../types/finance';
import { sanitizeParticipantUserId } from '../lib/supabaseMap';
import { createChargeRequests } from '../lib/chargeRequests';
import { useUser } from './UserContext';
import { createDealerHoursRequests, dealerKey, mergeDealerHours, type DealerHours } from '../lib/dealerHours';

function resolveLedgerUserId(userId: string): string | null {
  return sanitizeParticipantUserId(userId);
}

interface FinanceContextValue {
  transactions: Transaction[];
  isLoading: boolean;
  loadError: string | null;
  refreshFinance: () => Promise<void>;
  isDealerHoursPending: (tournamentId: string, userId: string) => boolean;
  getDealerHours: (tournamentId: string, userId: string) => number;
  getDealerLoggedAt: (tournamentId: string, userId: string) => string | undefined;
  adjustDealerHours: (tournamentId: string, userId: string, delta: number) => Promise<boolean>;
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

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dealerHoursMap, setDealerHoursMap] = useState<Record<string, DealerHours>>({});
  const [pendingHours, setPendingHours] = useState<Set<string>>(new Set());
  const busyHours = useRef(new Set<string>());
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchSequence = useRef(0);
  const mutationVersion = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const { account } = useUser();
  const actorId = account?.id ?? '';
  const chargeRequests = useMemo(() => createChargeRequests(createCharge, undefined,
    { scope: actorId, storage: () => sessionStorage }), [actorId]);

  const hoursRequests = useMemo(() => createDealerHoursRequests(adjustDealerHoursOnServer, undefined,
    { scope: actorId, storage: () => sessionStorage }), [actorId]);
  const actorRole = account?.role;

  const refreshFinance = useCallback(async () => {
    const sequence = ++fetchSequence.current;
    const version = mutationVersion.current;
    try {
      const snapshot = await fetchFinanceSnapshot();
      if (sequence !== fetchSequence.current || version !== mutationVersion.current) return;
      setTransactions(snapshot.transactions);
      setDealerHoursMap((prev) => mergeDealerHours(prev, snapshot.dealerHours));
      setLoadError(null);
    } catch {
      if (sequence !== fetchSequence.current || version !== mutationVersion.current) return;
      setLoadError('Не удалось загрузить финансы. Повторите загрузку перед изменениями.');
      setTransactions([]);
      setDealerHoursMap({});
    } finally {
      if (sequence === fetchSequence.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setTransactions([]);
    setDealerHoursMap({});
    setIsLoading(true);
    void refreshFinance();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshFinance();
    }, 15000);
    return () => { window.clearInterval(interval); fetchSequence.current++; };
  }, [actorId, actorRole, refreshFinance]);

  const getDealerHours = useCallback(
    (tournamentId: string, userId: string) => dealerHoursMap[dealerKey(tournamentId, userId)]?.hours ?? 0,
    [dealerHoursMap],
  );
  const getDealerLoggedAt = useCallback(
    (tournamentId: string, userId: string) => dealerHoursMap[dealerKey(tournamentId, userId)]?.loggedAt,
    [dealerHoursMap],
  );
  const isDealerHoursPending = useCallback(
    (tournamentId: string, userId: string) => pendingHours.has(dealerKey(tournamentId, userId)),
    [pendingHours],
  );
  const adjustDealerHours = useCallback(async (tournamentId: string, userId: string, delta: number) => {
    const ledgerUserId = resolveLedgerUserId(userId);
    if (!ledgerUserId || isLoading || loadError) return false;
    const key = dealerKey(tournamentId, ledgerUserId);
    if (busyHours.current.has(key)) return false;
    busyHours.current.add(key);
    setPendingHours(new Set(busyHours.current));
    try {
      const saved = await hoursRequests({ tournamentId, userId: ledgerUserId, delta });
      mutationVersion.current++;
      setDealerHoursMap((prev) => mergeDealerHours(prev, [saved]));
      return true;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось подтвердить часы дилера');
      return false;
    } finally {
      busyHours.current.delete(key);
      setPendingHours(new Set(busyHours.current));
    }
  }, [hoursRequests, isLoading, loadError]);

  // Canonical hours also override an older charge/payment response that arrived late.
  const visibleTransactions = useMemo(() => transactions.map((tx) => {
    const hours = dealerHoursMap[dealerKey(tx.tournamentId, tx.userId)];
    return hours ? { ...tx, dealerHours: hours.hours, isDealer: hours.hours > 0 } : tx;
  }), [transactions, dealerHoursMap]);

  const submitCharge = useCallback(
    (tournamentId: string, userId: string, type: TransactionType, comment = '') => {
      const ledgerUserId = resolveLedgerUserId(userId);
      if (!ledgerUserId) {
        window.alert('Нельзя выставить счёт: игрок не найден в базе пользователей');
        return;
      }
      void chargeRequests({ tournamentId, userId: ledgerUserId, type, comment })
        .then((saved) => {
          mutationVersion.current++;
          setTransactions((prev) => [saved, ...prev.filter((tx) => tx.id !== saved.id)]);
        })
        .catch((error) => {
          window.alert(error instanceof Error ? error.message : 'Не удалось подтвердить создание счёта');
        });
    }, [chargeRequests],
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
        mutationVersion.current++;
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
      mutationVersion.current++;
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
      transactions: visibleTransactions,
      isLoading,
      loadError,
      refreshFinance,
      isDealerHoursPending,
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
      visibleTransactions,
      isLoading,
      loadError,
      refreshFinance,
      isDealerHoursPending,
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
