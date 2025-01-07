/**
 * Common Utilities
 * Shared utility functions used across the application
 * @module utils/common
 */

/**
 * Sleep for a specified duration
 * @param {number} ms - Time to sleep in milliseconds
 * @param {object} [options] - Sleep options
 * @param {number} [options.jitter] - Jitter factor (0-1) to add randomness to sleep duration
 * @returns {Promise<void>} Promise that resolves after the specified duration
 * @example
 * // Sleep for 1 second
 * await sleep(1000);
 *
 * // Sleep with a random jitter between 900-1100ms
 * await sleep(1000, { jitter: 0.1 });
 */
export async function sleep(ms, options = {}) {
  const { jitter = 0 } = options;
  let timeout = ms;
  if (jitter > 0) {
    // Add random jitter between (1-jitter) and (1+jitter)
    // Using crypto.getRandomValues for better randomness
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const randomValue = array[0] / (0xffffffff + 1); // Convert to 0-1 range
    const factor = 1 + jitter * (2 * randomValue - 1);
    timeout = Math.floor(ms * factor);
  }
  return new Promise(resolve => setTimeout(resolve, timeout));
}

/**
 * Calculates exponential backoff with jitter
 * @param {object} options - Backoff options
 * @param {number} options.attempt - Current attempt number (1-based)
 * @param {number} options.initialDelayMs - Initial delay in milliseconds
 * @param {number} options.maxDelayMs - Maximum delay in milliseconds
 * @param {number} [options.backoffFactor] - Factor to multiply delay by each attempt
 * @param {number} [options.jitter] - Random jitter factor (0-1) to add to delay
 * @returns {number} The calculated delay in milliseconds
 * @example
 * const delay = calculateBackoff({
 *   attempt: 2,
 *   initialDelayMs: 1000,
 *   maxDelayMs: 10000,
 *   backoffFactor: 2,
 *   jitter: 0.1
 * });
 */
export function calculateBackoff({
  attempt,
  initialDelayMs,
  maxDelayMs,
  backoffFactor = 2,
  jitter = 0.1
}) {
  // Calculate base delay with exponential backoff
  const baseDelay = Math.min(initialDelayMs * Math.pow(backoffFactor, attempt - 1), maxDelayMs);

  if (jitter <= 0) {
    return Math.round(baseDelay);
  }

  // Add jitter to prevent thundering herd using crypto.getRandomValues
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const randomValue = array[0] / (0xffffffff + 1); // Convert to 0-1 range
  const jitterRange = baseDelay * jitter;
  const randomJitter = randomValue * jitterRange * 2 - jitterRange;
  return Math.round(Math.max(0, baseDelay + randomJitter));
}

/**
 * Retries an operation with exponential backoff
 * @template T
 * @param {() => Promise<T>} operation - Operation to retry
 * @param {object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts
 * @param {number} options.initialDelayMs - Initial delay between retries in milliseconds
 * @param {number} options.maxDelayMs - Maximum delay between retries in milliseconds
 * @param {number} [options.backoffFactor] - Factor to multiply delay by each attempt
 * @param {number} [options.jitter] - Random jitter factor (0-1) to add to delay
 * @param {(error: Error, attempt: number) => boolean} [options.shouldRetry] - Function to determine if retry should be attempted
 * @returns {Promise<T>} The result of the operation
 * @example
 * const result = await retryWithBackoff(
 *   async () => {
 *     // Operation that might fail
 *     return await someAsyncOperation();
 *   },
 *   {
 *     maxRetries: 3,
 *     initialDelayMs: 1000,
 *     maxDelayMs: 5000,
 *     shouldRetry: (error, attempt) => {
 *       // Only retry network errors and limit to 3 attempts
 *       return error.code === 'NETWORK_ERROR' && attempt <= 3;
 *     }
 *   }
 * );
 */
export async function retryWithBackoff(operation, options) {
  const {
    maxRetries,
    initialDelayMs,
    maxDelayMs,
    backoffFactor = 2,
    jitter = 0.1,
    shouldRetry = (_, attempt) => attempt <= maxRetries
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }

      const delay = calculateBackoff({
        attempt,
        initialDelayMs,
        maxDelayMs,
        backoffFactor,
        jitter
      });

      await sleep(delay);
    }
  }

  throw lastError;
}
