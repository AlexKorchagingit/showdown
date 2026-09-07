import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { claimRubyNotification, createShopRequests, fetchWallet, mergeWallet, sendShopCommand, type ShopIntent, type Wallet } from '../lib/wallet';

export function useWallet(userId: string) {
  const actor = useRef(userId);
  actor.current = userId;
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(new Set<string>());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const sequence = useRef(0);
  const refreshing = useRef(new Set<string>());
  const requests = useMemo(() => createShopRequests(userId, undefined,
    { scope: userId, storage: () => sessionStorage }, (input) => {
      if (actor.current !== userId) throw new Error('Учётная запись изменилась. Операция не отправлена.');
      return sendShopCommand(userId, input);
    }), [userId]);
  const refresh = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    // A poll interval must not supersede a slower request before its timeout can
    // update the UI. This was the source of the endless shop loading state.
    if (refreshing.current.has(userId)) return;
    refreshing.current.add(userId);
    const seq = ++sequence.current;
    try {
      const saved = await fetchWallet(userId);
      if (actor.current !== userId || seq !== sequence.current) return;
      setWallet((prev) => mergeWallet(prev, saved));
      setError(null);
    } catch {
      if (actor.current !== userId || seq !== sequence.current) return;
      setError('Не удалось загрузить кошелёк. Обновите данные перед операцией.');
    } finally {
      refreshing.current.delete(userId);
      if (actor.current === userId && seq === sequence.current) setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    actor.current = userId;
    setWallet(null); setLoading(true); setError(null);
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 10000);
    return () => { actor.current = ''; window.clearInterval(timer); sequence.current++; };
  }, [refresh]);
  const run = useCallback(async (operation: () => Promise<Wallet>) => {
    if (!userId || actor.current !== userId || loading || error || busy.current.has(userId)) return false;
    busy.current.add(userId); setPending(new Set(busy.current));
    // Invalidate an older in-flight refresh; confirmed responses are merged by revision.
    sequence.current++;
    try {
      const saved = await operation();
      if (actor.current !== userId) return false;
      setWallet((prev) => mergeWallet(prev, saved));
      return true;
    } catch (failure) {
      if (actor.current === userId) {
        window.alert(failure instanceof Error ? failure.message : 'Не удалось подтвердить операцию');
        void refresh();
      }
      return false;
    } finally { busy.current.delete(userId); setPending(new Set(busy.current)); }
  }, [error, loading, refresh, userId]);
  const shop = useCallback((intent: ShopIntent) => run(() => requests(intent)), [requests, run]);
  const claim = useCallback((notificationId: string) => run(() => claimRubyNotification(userId, notificationId)), [run, userId]);
  return { wallet: wallet?.userId === userId ? wallet : null, isLoading: loading,
    error, isBusy: pending.has(userId), refresh, shop, claim };
}
