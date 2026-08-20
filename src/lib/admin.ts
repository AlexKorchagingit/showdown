export const ADMIN_EMAIL = 'anaak-01@mail.ru';

export function isSuperAdmin(email: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}
