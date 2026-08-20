// Pure retry helper for the silent-refresh flow.
//
// Extracted from `store/auth.ts` so the "refresh must never log out on a
// transient failure" behavior can be unit-tested without importing the whole
// auth store (which pulls in transport, keychain, message store, etc.).
//
// Regression guard: a single transient failure (network hiccup, concurrent
// rotation from another tab) must NOT return failure — we retry up to
// `attempts` times with a small backoff. Only persistent failure returns null.

export interface RefreshResult {
  accessToken: string;
  [key: string]: unknown;
}

export async function refreshWithRetry(
  refreshOnce: () => Promise<unknown>,
  attempts = 3,
  backoffBaseMs = 400
): Promise<RefreshResult | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const data = await refreshOnce();
      if (
        data &&
        typeof data === 'object' &&
        'accessToken' in data &&
        typeof (data as Record<string, unknown>).accessToken === 'string'
      ) {
        return data as RefreshResult;
      }
    } catch (error) {
      // Transient failure — fall through to retry (or final failure below).
      console.debug('[Auth] Refresh attempt failed:', error instanceof Error ? error.message : error);
    }
    if (attempt < attempts - 1) {
      await new Promise((r) => setTimeout(r, backoffBaseMs * (attempt + 1)));
    }
  }
  return null;
}
