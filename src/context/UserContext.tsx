import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ADMIN_EMAIL, isSuperAdmin } from '../lib/admin';
import { getClubDirectory } from '../lib/clubDirectory';
import {
  fetchClubUsers,
  fetchUserByEmail,
  fetchUserById,
  mappedUserToPatch,
  updateUserRow,
  type MappedUser,
} from '../lib/userApi';
import { addLog as insertClubLog, type AddLogInput } from '../lib/logApi';
import { readSessionUserId, writeSession } from '../lib/session';

export { ADMIN_EMAIL, isSuperAdmin };
export { addLog } from '../lib/logApi';

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

export function UserProvider({ email, children }: { email: string; children: ReactNode }) {
  const [account, setAccount] = useState<MappedUser | null>(null);
  const [clubUsers, setClubUsers] = useState<MappedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshClubUsers = useCallback(async () => {
    const users = await fetchClubUsers();
    setClubUsers(users);
  }, []);

  const refreshAccount = useCallback(async () => {
    setIsLoading(true);
    try {
      const savedId = readSessionUserId();
      const loaded =
        (savedId ? await fetchUserById(savedId) : null) ?? (await fetchUserByEmail(email));
      if (loaded) {
        writeSession(email || loaded.email, loaded.id);
        setAccount(loaded);
      } else {
        setAccount(null);
      }
      await refreshClubUsers();
    } finally {
      setIsLoading(false);
    }
  }, [email, refreshClubUsers]);

  useEffect(() => {
    void refreshAccount();
  }, [refreshAccount]);

  const patchAccount = useCallback(
    async (changes: Partial<MappedUser>) => {
      if (!account) return null;
      const patch = mappedUserToPatch(changes);
      if (Object.keys(patch).length === 0) return account;
      const next = await updateUserRow(account.id, patch);
      if (!next) return account;
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

  const value = useMemo<UserContextValue>(
    () => ({
      email: account?.email || email,
      userId: account?.id || readSessionUserId(),
      isAdmin: isClubAdmin(email, account),
      isLoading,
      account,
      clubUsers,
      patchAccount,
      refreshAccount,
      refreshClubUsers,
      addLog,
    }),
    [account, addLog, clubUsers, email, isLoading, patchAccount, refreshAccount, refreshClubUsers],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
