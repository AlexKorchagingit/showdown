import { useLocation } from 'react-router-dom';
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
  voidTransactionOnServer,
  fetchFinanceSnapshot,
  createCharge,
  adjustDealerHoursOnServer,
  markTransactionsPaid,
  compTransactions,
} from '../lib/financeApi';
import {
  type Transaction,
  type TransactionType,
} from '../types/finance';
import { ledgerChargeId } from '../lib/guestPlayer';
import { sanitizeParticipantUserId } from '../lib/supabaseMap';
import { createChargeRequests } from '../lib/chargeRequests';
import { useUser } from './UserContext';
import { isActiveTransaction, mergeTransactionUpdates, reconcileTransactionSnapshot } from '../lib/transactionVoid';
import { createDealerHoursRequests, dealerKey, mergeDealerHours, type DealerHours } from '../lib/dealerHours';
import {
  effectiveFinanceScope,
  FINANCE_LIVE_POLL_MS,
  FINANCE_POLL_MS,
  financeWatchMode,
  financeWatchRepeats,
  financeWatchScope,
} from '../lib/financeWatch';

function resolveLedgerUserId(userId: string): string | null {
  return ledgerChargeId(userId);
}

interface FinanceContextValue {
  transactions: Transaction[];
  voidedTransactions: Transaction[];
  isTransactionVoiding: (transactionId: string) => boolean;
  isLoading: boolean;
  loadError: string | null;
  refreshFinance: (scope?: 'month' | 'all') => Promise<void>;
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
  markPaid: (transactionIds: string[]) => Promise<boolean>;
  compCharges: (transactionIds: string[]) => Promise<boolean>;
  voidTransaction: (transactionId: string, reason: string) => Promise<boolean>;
  markAllUnpaidForPlayer: (userId: string) => void;
  unpaidForPlayer: (tournamentId: string, userId: string) => Transaction[];
  unpaidTotalForPlayer: (tournamentId: string, userId: string) => number;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dealerHoursMap, setDealerHoursMap] = useState<Record<string, DealerHours>>({});
  const [pendingHours, setPendingHours] = useState<Set<string>>(new Set());
  const busyHours = useRef(new Set<string>());
  const busyVoids = useRef(new Set<string>());
  const [pendingVoids, setPendingVoids] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchSequence = useRef(0);
  const refreshing = useRef(new Set<string>());
  const mutationVersion = useRef(0);
  const [isLoading, setIsLoading] = useState(false);
  const financeScopeRef = useRef<'month' | 'all'>('month');
  const pendingFullLedgerRef = useRef(false);
  const ledgerReadyRef = useRef(false);
  const ledgerFailedRef = useRef(false);
  const { account } = useUser();
  const actorId = account?.id ?? '';
  const chargeRequests = useMemo(() => createChargeRequests(createCharge, undefined,
    { scope: actorId, storage: () => sessionStorage }), [actorId]);

  const hoursRequests = useMemo(() => createDealerHoursRequests(adjustDealerHoursOnServer, undefined,
    { scope: actorId, storage: () => sessionStorage }), [actorId]);
  const actorRole = account?.role;
  const refreshScope = `${actorId}:${actorRole ?? ''}`;

  const refreshFinance = useCallback(async (scope?: 'month' | 'all') => {
    const effective = effectiveFinanceScope(financeScopeRef.current, scope);
    if (effective === 'all') financeScopeRef.current = 'all';
    if (refreshing.current.has(refreshScope)) {
      if (effective === 'all') pendingFullLedgerRef.current = true;
      return;
    }
    refreshing.current.add(refreshScope);
    const sequence = ++fetchSequence.current;
    const version = mutationVersion.current;
    // Only the first read of a session blocks screens; later polls update quietly.
    if (!ledgerReadyRef.current && !ledgerFailedRef.current) setIsLoading(true);
    try {
      const snapshot = await fetchFinanceSnapshot(effective);
      if (sequence !== fetchSequence.current || version !== mutationVersion.current) return;
      setTransactions((prev) => reconcileTransactionSnapshot(prev, snapshot.transactions));
      setDealerHoursMap((prev) => mergeDealerHours(prev, snapshot.dealerHours));
      setLoadError(null);
      ledgerReadyRef.current = true;
      ledgerFailedRef.current = false;
    } catch {
      if (sequence !== fetchSequence.current || version !== mutationVersion.current) return;
      ledgerFailedRef.current = true;
      setLoadError('Не удалось загрузить финансы. Повторите загрузку перед изменениями.');
    } finally {
      refreshing.current.delete(refreshScope);
      if (sequence === fetchSequence.current) setIsLoading(false);
      if (pendingFullLedgerRef.current) {
        pendingFullLedgerRef.current = false;
        void refreshFinance('all');
      }
    }
  }, [refreshScope]);

  useEffect(() => {
    financeScopeRef.current = 'month';
    ledgerReadyRef.current = false;
    ledgerFailedRef.current = false;
    setTransactions([]);
    setDealerHoursMap({});
    setIsLoading(false);
    return () => { fetchSequence.current++; };
  }, [actorId, actorRole]);

  const financeWatch = financeWatchMode(location.pathname);
  useEffect(() => {
    if (!actorId || financeWatch === 'off') return;
    const pull = () => {
      if (document.visibilityState !== 'visible') return;
      void refreshFinance(financeWatchScope(financeWatch));
    };
    pull();
    if (!financeWatchRepeats(financeWatch)) return;
    const interval = window.setInterval(
      pull,
      financeWatch === 'live' ? FINANCE_LIVE_POLL_MS : FINANCE_POLL_MS,
    );
    const onVisible = () => {
      if (document.visibilityState === 'visible') pull();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [actorId, financeWatch, location.pathname, refreshFinance]);

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
    const ledgerUserId = sanitizeParticipantUserId(userId);
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
          setTransactions((prev) => mergeTransactionUpdates(prev, [saved]));
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

  const markPaid = useCallback(async (transactionIds: string[]): Promise<boolean> => {
    if (transactionIds.length === 0) return false;
    try {
      const saved = await markTransactionsPaid(transactionIds);
      mutationVersion.current++;
      setTransactions((prev) => mergeTransactionUpdates(prev, saved));
      return true;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось отметить оплату');
      return false;
    }
  }, []);

  const compCharges = useCallback(async (transactionIds: string[]): Promise<boolean> => {
    if (transactionIds.length === 0) return false;
    try {
      const saved = await compTransactions(transactionIds);
      mutationVersion.current++;
      setTransactions((prev) => mergeTransactionUpdates(prev, saved));
      return true;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось зафиксировать билет');
      return false;
    }
  }, []);

  const isTransactionVoiding = useCallback((transactionId: string) => pendingVoids.has(transactionId), [pendingVoids]);
  const voidTransaction = useCallback(async (transactionId: string, reason: string): Promise<boolean> => {
    if (isLoading || loadError || busyVoids.current.has(transactionId)) return false;
    busyVoids.current.add(transactionId);
    setPendingVoids(new Set(busyVoids.current));
    try {
      const saved = await voidTransactionOnServer(transactionId, reason);
      mutationVersion.current++;
      setTransactions((prev) => mergeTransactionUpdates(prev, [saved]));
      return true;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось подтвердить отмену');
      return false;
    } finally {
      busyVoids.current.delete(transactionId);
      setPendingVoids(new Set(busyVoids.current));
    }
  }, [isLoading, loadError]);

  const unpaidForPlayer = useCallback(
    (tournamentId: string, userId: string) =>
      transactions.filter(
        (tx) =>
          tx.tournamentId === tournamentId &&
          tx.userId === userId &&
          tx.status === 'unpaid' && isActiveTransaction(tx),
      ),
    [transactions],
  );

  const unpaidTotalForPlayer = useCallback(
    (tournamentId: string, userId: string) =>
      unpaidForPlayer(tournamentId, userId).reduce((sum, tx) => sum + tx.amount, 0),
    [unpaidForPlayer],
  );

  const markAllUnpaidForPlayer = useCallback(
    (userId: string) => {
      const ids = transactions
        .filter((tx) => tx.userId === userId && tx.status === 'unpaid' && isActiveTransaction(tx))
        .map((tx) => tx.id);
      if (ids.length) void markPaid(ids);
    },
    [transactions, markPaid],
  );

  const activeTransactions = useMemo(() => visibleTransactions.filter(isActiveTransaction), [visibleTransactions]);
  const voidedTransactions = useMemo(() => visibleTransactions.filter((tx) => !isActiveTransaction(tx)), [visibleTransactions]);
  const value = useMemo(
    () => ({
      transactions: activeTransactions,
      voidedTransactions,
      isTransactionVoiding,
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
      compCharges,
      voidTransaction,
      markAllUnpaidForPlayer,
      unpaidForPlayer,
      unpaidTotalForPlayer,
    }),
    [
      activeTransactions,
      voidedTransactions,
      isTransactionVoiding,
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
      compCharges,
      voidTransaction,
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
