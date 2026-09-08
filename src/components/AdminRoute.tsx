import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { hasRequiredAdminRole, type AdminRole } from '../lib/roles';
import { ScreenLoading } from './ScreenLoading';

interface Props {
  children?: ReactNode;
  requiredRole?: AdminRole;
}

/**
 * Client-side navigation guard. It keeps protected screens out of the UI, while
 * the database RPC/RLS checks remain the authoritative security boundary.
 */
export function AdminRoute({ children, requiredRole = 'admin' }: Props) {
  const { account, isLoading } = useUser();

  if (isLoading) {
    return <ScreenLoading label="Проверка прав…" />;
  }

  if (!hasRequiredAdminRole(account?.role, requiredRole)) {
    return <Navigate to="/profile" replace />;
  }

  return children === undefined ? <Outlet /> : <>{children}</>;
}
