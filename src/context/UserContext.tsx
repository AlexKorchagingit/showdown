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
import { ADMIN_EMAIL, isSuperAdmin } from '../lib/admin';
import { getClubDirectory } from '../lib/clubDirectory';
import {
  applyCosmeticsResetToAllUsers,
  fetchClubUsers,
  lookupSessionAccount,
  mappedUserToPatch,
  updateUserRow,
  type MappedUser,
} from '../lib/userApi';
import { addLog as insertClubLog, type AddLogInput } from '../lib/logApi';
import { endLocalSession, readSessionUserId, writeSession } from '../lib/session';
import { supabase } from '../lib/supabase';

export { ADMIN_EMAIL, isSuperAdmin };
export { addLog } from '../lib/logApi';

const SESSION_POLL_MS = 10_000;

export function isClubAdmin(email: string, account?: MappedUser | null): boolean {
  if (isSuperAdmin(email)) return true;
  if (account?.isAdmin) return true;
  return getClubDirectory().some(
    (user) => user.email.trim().toLowerCase() === email.trim().toLowerCase() && user.isAdmin,
  );
}

interface UserContextValue {
  email: string;
  userId: string;
  isAdmin: boolean;
  isLoading: boolean;
  account: MappedUser | null;
  clubUsers: MappedUser[];
  patchAccount: (changes: Partial<MappedUser>) => Promise<MappedUser | null>;
  refreshAccount: () => Promise<void>;
  refreshClubUsers: () => Promise<void>;
  addLog: (input: Omit<AddLogInput, 'admin_id' | 'admin_email' | 'admin_name'> & Partial<AddLogInput>) => Promise<boolean>;
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
  const cosmeticsResetDoneRef = useRef(false);

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
      if (!cosmeticsResetDoneRef.current) {
        void applyCosmeticsResetToAllUsers()
          .then(async (reset) => {
            if (reset.ok) cosmeticsResetDoneRef.current = true;
            if (reset.updated > 0) {
              await enforceSession();
              await refreshClubUsers();
            }
          })
          .catch((error) => {
            console.error(error);
          });
      }
      await refreshClubUsers();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [enforceSession, refreshClubUsers]);

  useEffect(() => {
    kickedRef.current = false;
    cosmeticsResetDoneRef.current = false;
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

  const addLog = useCallback(
    async (
      input: Omit<AddLogInput, 'admin_id' | 'admin_email' | 'admin_name'> & Partial<AddLogInput>,
    ) => {
      return insertClubLog({
        admin_id: input.admin_id ?? account?.id ?? readSessionUserId() ?? null,
        admin_email: input.admin_email ?? account?.email ?? email,
        admin_name: input.admin_name ?? account?.nickname ?? '',
        action_type: input.action_type,
        target_user_id: input.target_user_id ?? null,
        target_user_email: input.target_user_email ?? null,
        target_user_name: input.target_user_name ?? null,
        target_tournament_id: input.target_tournament_id ?? null,
        target_tournament_name: input.target_tournament_name ?? null,
        details: input.details ?? null,
      });
    },
    [account?.email, account?.id, account?.nickname, email],
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
      isLoading,
      account,
      clubUsers: visibleClubUsers,
      patchAccount,
      refreshAccount,
      refreshClubUsers,
      addLog,
    }),
    [
      account,
      addLog,
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
