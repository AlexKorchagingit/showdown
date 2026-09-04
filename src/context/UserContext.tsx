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
import { hasAdminRole, hasSuperAdminRole } from '../lib/roles';
import {
  fetchClubUsers,
  lookupSessionAccount,
  mappedUserToPatch,
  updateUserRow,
  type MappedUser,
} from '../lib/userApi';
import { endLocalSession, readSessionUserId, writeSession } from '../lib/session';
import { supabase } from '../lib/supabase';

export { hasSuperAdminRole as isSuperAdmin } from '../lib/roles';

const SESSION_POLL_MS = 10_000;

export function isClubAdmin(_email: string, account?: MappedUser | null): boolean {
  return hasAdminRole(account?.role);
}

interface UserContextValue {
  email: string;
  userId: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isLoading: boolean;
  account: MappedUser | null;
  clubUsers: MappedUser[];
  patchAccount: (changes: Partial<MappedUser>) => Promise<MappedUser | null>;
  refreshAccount: () => Promise<void>;
  refreshClubUsers: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({
  email,
  children,
  onAccountInvalid,
}: {
  email: string;
  children: ReactNode;
  onAccountInvalid?: () => void;
}) {
  const [account, setAccount] = useState<MappedUser | null>(null);
  const [clubUsers, setClubUsers] = useState<MappedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const onInvalidRef = useRef(onAccountInvalid);
  onInvalidRef.current = onAccountInvalid;
  const kickedRef = useRef(false);

  const kickDeletedAccount = useCallback(() => {
    if (kickedRef.current) return;
    kickedRef.current = true;
    setAccount(null);
    endLocalSession(email);
    onInvalidRef.current?.();
  }, [email]);

  const refreshClubUsers = useCallback(async () => {
    try {
      const users = await fetchClubUsers();
      setClubUsers(users);
    } catch (error) {
      console.error(error);
      setClubUsers([]);
    }
  }, []);

  const enforceSession = useCallback(async (): Promise<boolean> => {
    if (kickedRef.current) return false;
    try {
      const result = await lookupSessionAccount(readSessionUserId(), email);
      if (result.status === 'error') {
        console.error(result.message);
        return true;
      }
      if (result.status === 'missing') {
        kickDeletedAccount();
        return false;
      }
      writeSession(email || result.user.email, result.user.id);
      setAccount(result.user);
      return true;
    } catch (error) {
      console.error(error);
      return true;
    }
  }, [email, kickDeletedAccount]);

  const refreshAccount = useCallback(async () => {
    setIsLoading(true);
    try {
      const ok = await enforceSession();
      if (!ok) return;
      await refreshClubUsers();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [enforceSession, refreshClubUsers]);

  useEffect(() => {
    kickedRef.current = false;
    void refreshAccount();
  }, [refreshAccount]);

  useEffect(() => {
    const verify = () => {
      void enforceSession();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') verify();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', verify);
    const timer = window.setInterval(verify, SESSION_POLL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', verify);
      window.clearInterval(timer);
    };
  }, [enforceSession]);

  useEffect(() => {
    const userId = account?.id || readSessionUserId();
    if (!userId) return;
    const channel = supabase
      .channel(`session-user-${userId}`)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        () => {
          kickDeletedAccount();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [account?.id, kickDeletedAccount]);

  const patchAccount = useCallback(
    async (changes: Partial<MappedUser>) => {
      if (!account) return null;
      const patch = mappedUserToPatch(changes);
      if (Object.keys(patch).length === 0) return account;
      const next = await updateUserRow(account.id, patch);
      if (!next) return null;
      setAccount(next);
      setClubUsers((prev) => prev.map((user) => (user.id === next.id ? next : user)));
      return next;
    },
    [account],
  );

  const isAdmin = isClubAdmin(email, account);
  const visibleClubUsers = useMemo(() => {
    if (isAdmin) return clubUsers;
    return clubUsers.map((user) =>
      user.birthDate ? { ...user, birthDate: '' } : user,
    );
  }, [clubUsers, isAdmin]);

  const value = useMemo<UserContextValue>(
    () => ({
      email: account?.email || email,
      userId: account?.id || readSessionUserId(),
      isAdmin,
      isSuperAdmin: hasSuperAdminRole(account?.role),
      isLoading,
      account,
      clubUsers: visibleClubUsers,
      patchAccount,
      refreshAccount,
      refreshClubUsers,
    }),
    [
      account,
      email,
      isAdmin,
      isLoading,
      patchAccount,
      refreshAccount,
      refreshClubUsers,
      visibleClubUsers,
    ],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
