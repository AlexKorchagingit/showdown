import { createContext, useContext, useMemo, type ReactNode } from 'react';

export const ADMIN_EMAIL = 'anaak-01@mail.ru';

export function isSuperAdmin(email: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

interface UserContextValue {
  email: string;
  isAdmin: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ email, children }: { email: string; children: ReactNode }) {
  const value = useMemo(
    () => ({ email, isAdmin: isSuperAdmin(email) }),
    [email],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
