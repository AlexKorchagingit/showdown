export type EmailDeliveryStatus = 'accepted' | 'rejected' | 'uncertain';

export async function deliverOtpEmail(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs = 7000,
): Promise<EmailDeliveryStatus> {
  try {
    const result = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (result.ok) return 'accepted';
    // A provider may have accepted the email before its response was lost or
    // may retry a 5xx/429 internally. Keep the code valid in those cases.
    if (result.status === 408 || result.status === 429 || result.status >= 500) return 'uncertain';
    return 'rejected';
  } catch {
    return 'uncertain';
  }
}
