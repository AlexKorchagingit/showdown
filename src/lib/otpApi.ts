import { createTimeoutFetch, type FetchLike } from './network';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX = /^\d{4}$/;

type OtpErrorCode = 'invalid_input' | 'rate_limited' | 'unavailable';

export class OtpApiError extends Error {
  readonly code: OtpErrorCode;
  readonly retryAfter?: number;

  constructor(
    code: OtpErrorCode,
    message: string,
    retryAfter?: number,
  ) {
    super(message);
    this.name = 'OtpApiError';
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

interface OtpClientOptions {
  baseUrl: string;
  anonKey: string;
  fetchImpl?: FetchLike;
}

function normalizedEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    throw new OtpApiError('invalid_input', 'Введите корректный адрес электронной почты.');
  }
  return email;
}

async function readErrorCode(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: unknown };
    return typeof payload.error === 'string' ? payload.error : '';
  } catch {
    return '';
  }
}

export function createOtpClient({ baseUrl, anonKey, fetchImpl = fetch }: OtpClientOptions) {
  const apiUrl = baseUrl.replace(/\/$/, '');
  const timedFetch = createTimeoutFetch(12000, fetchImpl);

  const post = (path: 'request' | 'verify', body: Record<string, string>) => timedFetch(
    `${apiUrl}/functions/v1/login-otp/${path}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(body),
    },
  );

  return {
    async requestCode(value: string): Promise<void> {
      const email = normalizedEmail(value);
      const response = await post('request', { email });
      if (response.ok) return;

      const code = await readErrorCode(response);
      if (response.status === 429 || code === 'rate_limited') {
        const parsed = Number(response.headers.get('Retry-After') || 60);
        throw new OtpApiError(
          'rate_limited',
          'Код уже отправлен. Подождите минуту перед повторной отправкой.',
          Number.isFinite(parsed) ? parsed : 60,
        );
      }
      throw new OtpApiError('unavailable', 'Не удалось отправить код. Попробуйте ещё раз.');
    },

    async verifyCode(value: string, valueCode: string): Promise<boolean> {
      const email = normalizedEmail(value);
      const code = valueCode.trim();
      if (!CODE_REGEX.test(code)) {
        throw new OtpApiError('invalid_input', 'Введите четырёхзначный код.');
      }

      const response = await post('verify', { email, code });
      if (response.ok) {
        const payload = await response.json() as { verified?: unknown };
        return payload.verified === true;
      }
      if (response.status === 400 || response.status === 401 || response.status === 410 || response.status === 429) {
        return false;
      }
      throw new OtpApiError('unavailable', 'Не удалось проверить код. Попробуйте ещё раз.');
    },
  };
}

function productionClient() {
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (!baseUrl || !anonKey) {
    throw new OtpApiError('unavailable', 'Сервис входа временно недоступен.');
  }
  return createOtpClient({ baseUrl, anonKey });
}

export const requestLoginCode = (email: string) => productionClient().requestCode(email);
export const verifyLoginCode = (email: string, code: string) => productionClient().verifyCode(email, code);
