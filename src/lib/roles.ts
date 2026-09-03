export type ClubRole = 'user' | 'admin' | 'superadmin';

export function isClubRole(value: unknown): value is ClubRole {
  return value === 'user' || value === 'admin' || value === 'superadmin';
}

/** UI convenience only. Database/server checks remain authoritative. */
export function hasAdminRole(role: unknown): boolean {
  return role === 'admin' || role === 'superadmin';
}

export function hasSuperAdminRole(role: unknown): boolean {
  return role === 'superadmin';
}
