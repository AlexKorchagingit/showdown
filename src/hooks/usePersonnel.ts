import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPersonnelRequests, fetchPersonnel, mergePersonnel, type PersonnelIntent, type PersonnelRoster } from '../lib/personnel';

export function usePersonnel(actorId: string, role: string | undefined) {
  const allowed = role === 'admin' || role === 'superadmin';
  const scope = `${actorId}:${role ?? ''}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [state, setState] = useState<{ scope: string; rows: Record<string, PersonnelRoster> }>({ scope, rows: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const busy = useRef(new Set<string>());
  const sequence = useRef(0);
  const version = useRef(0);
  const requests = useMemo(() => createPersonnelRequests(undefined, undefined,
    { scope: actorId, storage: () => sessionStorage }), [actorId]);

  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    const startedVersion = version.current;
    if (!allowed) { setLoading(false); return; }
    try {
      const rows = await fetchPersonnel();
      if (currentScope.current !== scope || seq !== sequence.current || startedVersion !== version.current) return;
      setState((prev) => ({ scope, rows: mergePersonnel(prev.scope === scope ? prev.rows : {}, rows, true) }));
      setError(null);
    } catch {
      if (currentScope.current !== scope || seq !== sequence.current || startedVersion !== version.current) return;
      setState({ scope, rows: {} });
      setError('Не удалось загрузить персонал. Повторите загрузку перед изменениями.');
    } finally {
      if (currentScope.current === scope && seq === sequence.current) setLoading(false);
    }
  }, [allowed, scope]);

  useEffect(() => {
    setState({ scope, rows: {} });
    setLoading(allowed);
    setError(null);
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    return () => { window.clearInterval(timer); sequence.current++; };
  }, [allowed, refresh, scope]);

  const command = useCallback(async (intent: PersonnelIntent) => {
    const key = `${scope}:${intent.tournamentId}`;
    if (!allowed || currentScope.current !== scope || loading || error || busy.current.has(key)) return false;
    busy.current.add(key);
    setPending(new Set(busy.current));
    version.current++;
    try {
      const saved = await requests(intent);
      if (currentScope.current !== scope) return false;
      version.current++;
      setState((prev) => ({ scope, rows: mergePersonnel(prev.scope === scope ? prev.rows : {}, [saved]) }));
      return true;
    } catch (failure) {
      if (currentScope.current === scope) window.alert(failure instanceof Error ? failure.message : 'Не удалось подтвердить изменение персонала');
      return false;
    } finally {
      busy.current.delete(key);
      setPending(new Set(busy.current));
    }
  }, [allowed, error, loading, requests, scope]);

  return { rosters: allowed && state.scope === scope ? state.rows : {},
    isLoading: allowed && (loading || state.scope !== scope), error: allowed ? error : null,
    refresh, command, isPending: (tournamentId: string) => pending.has(`${scope}:${tournamentId}`) };
}
