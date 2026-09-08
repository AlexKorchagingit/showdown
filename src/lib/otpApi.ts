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
  storeSession?: (tokens: { access_token: string; refresh_token: string }) => Promise<void>;
  sessionRetryDelaysMs?: readonly number[];
}

type SessionTokens = { access_token: string; refresh_token: string };

type PendingSession = {
  email: string;
  code: string;
  tokens: SessionTokens;
};

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

export function createOtpClient({
  baseUrl,
  anonKey,
  fetchImpl = fetch,
  storeSession,
  sessionRetryDelaysMs = [0, 400, 1200],
}: OtpClientOptions) {
  const apiUrl = baseUrl.replace(/\/$/, '');
  const timedFetch = createTimeoutFetch(12000, fetchImpl);
  let pendingSession: PendingSession | null = null;

  const persistSession = async (tokens: SessionTokens): Promise<void> => {
    if (!storeSession) {
      throw new OtpApiError('unavailable', 'Сервер не создал сессию. Запросите код ещё раз.');
    }

    const retryDelays = sessionRetryDelaysMs.length > 0 ? sessionRetryDelaysMs : [0];
    for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
      const delayMs = retryDelays[attempt];
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      try {
        await storeSession(tokens);
        return;
      } catch {
        // The server already issued valid tokens. Retry only their local/session
        // installation; never repeat the one-time-code verification request.
      }
    }

    throw new OtpApiError(
      'unavailable',
      'Сессия получена, но соединение прервалось. Введите тот же код ещё раз.',
    );
  };

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
      pendingSession = null;
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

      if (pendingSession?.email === email && pendingSession.code === code) {
        await persistSession(pendingSession.tokens);
        pendingSession = null;
        return true;
      }

      const response = await post('verify', { email, code });
      if (response.ok) {
        const payload = await response.json() as {
          verified?: unknown; session?: { access_token?: unknown; refresh_token?: unknown };
        };
        if (payload.verified !== true) return false;
        if (typeof payload.session?.access_token !== 'string' || !payload.session.access_token ||
            typeof payload.session.refresh_token !== 'string' || !payload.session.refresh_token) {
          throw new OtpApiError('unavailable', 'Сервер не создал сессию. Запросите код ещё раз.');
        }

        const tokens = {
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token,
        };
        pendingSession = { email, code, tokens };
        try {
          await persistSession(tokens);
        } catch (error) {
          if (error instanceof OtpApiError) throw error;
          throw new OtpApiError(
            'unavailable',
            'Сессия получена, но соединение прервалось. Введите тот же код ещё раз.',
          );
        }
        pendingSession = null;
        return true;
      }
      if (response.status === 400 || response.status === 401 || response.status === 410 || response.status === 429) {
        return false;
      }
      throw new OtpApiError('unavailable', 'Не удалось проверить код. Попробуйте ещё раз.');
    },
  };
}
