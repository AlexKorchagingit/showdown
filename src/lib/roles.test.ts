import { describe, expect, it } from 'vitest';
import {
  hasAdminRole,
  hasRequiredAdminRole,
  hasSuperAdminRole,
  isClubRole,
} from './roles';

describe('server-issued application roles', () => {
  it('recognizes only the three explicit role names', () => {
    expect(['user','admin','superadmin'].every(isClubRole)).toBe(true);
    for (const value of [null, undefined, true, 'service_role', 'owner@example.test', { is_admin: true }]) {
      expect(isClubRole(value)).toBe(false);
      expect(hasAdminRole(value)).toBe(false);
      expect(hasSuperAdminRole(value)).toBe(false);
    }
  });
  it('separates admin and SuperAdmin', () => {
    expect(hasAdminRole('admin')).toBe(true);
    expect(hasAdminRole('superadmin')).toBe(true);
    expect(hasSuperAdminRole('admin')).toBe(false);
    expect(hasSuperAdminRole('superadmin')).toBe(true);
  });

  it('enforces the route role hierarchy without using identity fields', () => {
    expect(hasRequiredAdminRole('user')).toBe(false);
    expect(hasRequiredAdminRole('admin')).toBe(true);
    expect(hasRequiredAdminRole('superadmin')).toBe(true);
    expect(hasRequiredAdminRole('admin', 'superadmin')).toBe(false);
    expect(hasRequiredAdminRole('superadmin', 'superadmin')).toBe(true);
    expect(hasRequiredAdminRole('owner@example.test', 'superadmin')).toBe(false);
  });
});
