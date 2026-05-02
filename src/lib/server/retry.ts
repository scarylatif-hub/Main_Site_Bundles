/**
 * src/lib/server/retry.ts
 *
 * Shared exponential-backoff retry helper for server-side use.
 * Import this in any route that needs to retry an async operation.
 */

export type RetryResult<T> =
  | { success: true;  data: T }
  | { success: false; error: string };

/**
 * Retries `fn` up to `maxRetries` times with exponential backoff.
 *
 * `fn` must throw to signal failure — a returned value (even falsy) is
 * treated as success.
 *
 * @param fn          Async function to attempt
 * @param maxRetries  Total attempts (default 3)
 * @param baseDelayMs Base delay in ms; doubles each attempt (default 1 000)
 */
export async function retryWithBackoff<T>(
  fn:           () => Promise<T>,
  maxRetries:   number = 3,
  baseDelayMs:  number = 1_000
): Promise<RetryResult<T>> {
  let lastError = "Max retries exceeded";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(
        `[retry] Attempt ${attempt + 1}/${maxRetries} failed: ${lastError}`
      );

      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(`[retry] Waiting ${delay}ms before next attempt…`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  return { success: false, error: lastError };
}