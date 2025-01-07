import log from 'loglevel';

/**
 * @typedef {object} RetryOptions
 * @property {number} [maxRetries=5] - Maximum number of retry attempts
 * @property {number} [initialDelayMs=1000] - Initial delay between retries in milliseconds
 * @property {number} [maxDelayMs=10000] - Maximum delay between retries in milliseconds
 * @property {number} [backoffFactor=2] - Exponential backoff multiplier
 */

/**
 * @typedef {object} Point
 * @property {string} measurement - The measurement name
 * @property {object} tags - Key-value pairs for tagging the measurement
 * @property {object} fields - Key-value pairs of the actual measurement data
 * @property {Date|string|number} [timestamp] - Optional timestamp for the measurement
 */

/**
 * @typedef {object} RetryableInflux
 * @property {function(Point[]): Promise<void>} writePoints - Writes points to InfluxDB with retry
 * @property {function(): Promise<string[]>} getDatabaseNames - Gets list of databases with retry
 * @property {function(string): Promise<void>} createDatabase - Creates a database with retry
 * @property {function(): Promise<void>} ping - Pings InfluxDB with retry
 * @property {function(): Promise<void>} close - Closes the InfluxDB connection
 * @property {object} _influx - Original InfluxDB instance
 */

const DEFAULT_RETRY_OPTIONS = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2
};

/**
 * Error patterns that should not trigger retries
 * @type {Array<{pattern: RegExp, message: string}>}
 */
const FATAL_ERROR_PATTERNS = [
  { pattern: /unauthorized|forbidden/i, message: 'Authentication failed - check credentials' },
  { pattern: /database.*not.*found/i, message: 'Database not found - check database name' },
  { pattern: /invalid.*database/i, message: 'Invalid database name' }
];

/**
 * Error patterns that should trigger retries
 * @type {Array<{pattern: RegExp, maxAttempts: number}>}
 */
const RETRYABLE_ERROR_PATTERNS = [
  { pattern: /ENOTFOUND/, maxAttempts: 10, message: 'DNS resolution failed - check hostname' },
  {
    pattern: /ECONNREFUSED/,
    maxAttempts: 10,
    message: 'Connection refused - check if InfluxDB is running'
  },
  { pattern: /connect ETIMEDOUT/, maxAttempts: 5, message: 'Connection timeout' },
  {
    pattern: /No host available/,
    maxAttempts: 10,
    message: 'No host available - check network connectivity'
  }
];

/**
 * Determines if an error should trigger a retry attempt
 * @param {Error} error - The error to check
 * @param {number} attempt - Current attempt number
 * @returns {{ shouldRetry: boolean, maxAttempts?: number, message: string }} Object containing retry decision, max attempts if applicable, and error message
 */
function isRetryableError(error, attempt) {
  // Check for fatal errors first
  for (const { pattern, message } of FATAL_ERROR_PATTERNS) {
    if (pattern.test(error.message)) {
      return { shouldRetry: false, message };
    }
  }

  // Check for retryable errors
  for (const { pattern, maxAttempts, message } of RETRYABLE_ERROR_PATTERNS) {
    if (pattern.test(error.message)) {
      return {
        shouldRetry: attempt < maxAttempts,
        maxAttempts,
        message: `${message} (attempt ${attempt}/${maxAttempts})`
      };
    }
  }

  // Default to standard retry behavior
  return {
    shouldRetry: true,
    message: `Unexpected error: ${error.message}`
  };
}

/**
 * Calculates the delay for the next retry attempt
 * @param {number} attempt - Current attempt number
 * @param {number} initialDelay - Initial delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @param {number} backoffFactor - Factor to multiply delay by each attempt
 * @returns {number} The calculated delay in milliseconds with jitter applied
 */
function calculateBackoff(attempt, initialDelay, maxDelay, backoffFactor = 2) {
  // Add jitter to prevent thundering herd
  // eslint-disable-next-line sonarjs/pseudo-random
  const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15
  const delay = Math.min(initialDelay * Math.pow(backoffFactor, attempt - 1) * jitter, maxDelay);
  return Math.round(delay);
}

/**
 * Wraps an async operation with retry logic
 * @template T
 * @param {() => Promise<T>} operation - Operation to retry
 * @param {object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts
 * @param {number} options.initialDelayMs - Initial delay between retries in milliseconds
 * @param {number} options.maxDelayMs - Maximum delay between retries in milliseconds
 * @param {number} options.backoffFactor - Factor to multiply delay by each attempt
 * @returns {Promise<T>} The result of the operation after successful completion or throws after max retries
 */
async function withRetry(operation, options) {
  const { maxRetries, initialDelayMs, maxDelayMs, backoffFactor } = options;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const { shouldRetry, maxAttempts, message } = isRetryableError(error, attempt);

      if (!shouldRetry) {
        log.error(`Fatal InfluxDB error: ${message}`);
        throw error;
      }

      // Use pattern-specific max attempts if available
      const effectiveMaxRetries = maxAttempts || maxRetries;
      if (attempt === effectiveMaxRetries) {
        log.error(`Failed after ${attempt} attempts: ${error}`);
        throw error;
      }

      const delay = calculateBackoff(attempt, initialDelayMs, maxDelayMs, backoffFactor);
      log.warn(`InfluxDB operation failed: ${message}, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Creates a retryable InfluxDB client wrapper
 * @param {object} influx - Original InfluxDB client instance
 * @param {RetryOptions} [options] - Retry configuration options
 * @returns {RetryableInflux} Wrapped InfluxDB client with retry capabilities
 * @example
 * const influx = new InfluxDB({
 *   host: 'localhost',
 *   database: 'my-db'
 * });
 *
 * const retryableInflux = createRetryableInflux(influx, {
 *   maxRetries: 3,
 *   initialDelayMs: 1000
 * });
 *
 * // Operations will now automatically retry on failure
 * await retryableInflux.writePoints([
 *   {
 *     measurement: 'cpu',
 *     tags: { host: 'server1' },
 *     fields: { value: 0.64 }
 *   }
 * ]);
 */
export function createRetryableInflux(influx, options = DEFAULT_RETRY_OPTIONS) {
  let isShutdown = false;

  return {
    async writePoints(points) {
      if (isShutdown) {
        throw new Error('InfluxDB client is shutdown');
      }
      return withRetry(() => influx.writePoints(points), options);
    },

    async getDatabaseNames() {
      if (isShutdown) {
        throw new Error('InfluxDB client is shutdown');
      }
      return withRetry(() => influx.getDatabaseNames(), options);
    },

    async createDatabase(name) {
      if (isShutdown) {
        throw new Error('InfluxDB client is shutdown');
      }
      return withRetry(() => influx.createDatabase(name), options);
    },

    async ping() {
      if (isShutdown) {
        throw new Error('InfluxDB client is shutdown');
      }
      return withRetry(() => influx.ping(), options);
    },

    async close() {
      isShutdown = true;
      // Ensure all pending operations are completed
      // Note: The influx library doesn't have a built-in close method,
      // but we mark the client as shutdown to prevent new operations
      log.info('InfluxDB client marked as shutdown');
    },

    _influx: influx
  };
}
