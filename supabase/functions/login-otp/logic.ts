const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX = /^\d{4}$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email) || email.length > 254) return null;
  return email;
}

export function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim();
  return CODE_REGEX.test(code) ? code : null;
}

export function codeFromRandomBytes(bytes: Uint8Array): string {
  if (bytes.length < 4) throw new Error('Four random bytes are required');
  const value = (((bytes[0] * 256 + bytes[1]) * 256 + bytes[2]) * 256 + bytes[3]) >>> 0;
  return (value % 10_000).toString().padStart(4, '0');
}

export function isAllowedOrigin(origin: string | null, allowedOrigins: string[]): boolean {
  return typeof origin === 'string' && allowedOrigins.includes(origin);
}
