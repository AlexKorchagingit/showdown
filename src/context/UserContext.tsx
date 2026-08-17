import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { mockUsers } from '../data/mockUsers';

export const ADMIN_EMAIL = 'anaak-01@mail.ru';

export function isSuperAdmin(email: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

export function isClubAdmin(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (normalized === ADMIN_EMAIL) return true;
  return mockUsers.some(
    (user) => user.email.trim().toLowerCase() === normalized && user.isAdmin,
  );
}

interface UserContextValue {
  email: string;
  isAdmin: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ email, children }: { email: string; children: ReactNode }) {
  const value = useMemo(
    () => ({ email, isAdmin: isClubAdmin(email) }),
    [email],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
