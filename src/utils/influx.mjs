/**
 * InfluxDB Client Wrapper
 * Provides retryable InfluxDB operations
 * @module utils/influx
 */

import log from 'loglevel';
import { retryWithBackoff } from './common.mjs';

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
  let influxClientShutdown = false;

  /**
   * Wraps an InfluxDB operation with retry logic
   * @template T
   * @param {() => Promise<T>} operation - Operation to retry
   * @returns {Promise<T>} The result of the operation
   */
  function withInfluxRetry(operation) {
    if (influxClientShutdown) {
      throw new Error('InfluxDB client is shutdown');
    }

    return retryWithBackoff(operation, {
      ...options,
      shouldRetry: (error, attempt) => {
        const { shouldRetry, message } = isRetryableError(error, attempt);
        if (!shouldRetry) {
          log.error(`Fatal InfluxDB error: ${message}`);
        } else {
          log.warn(`InfluxDB operation failed: ${message}, retrying...`);
        }
        return shouldRetry;
      }
    });
  }

  return {
    writePoints: points => withInfluxRetry(() => influx.writePoints(points)),
    getDatabaseNames: () => withInfluxRetry(() => influx.getDatabaseNames()),
    createDatabase: name => withInfluxRetry(() => influx.createDatabase(name)),
    ping: () => withInfluxRetry(() => influx.ping()),

    async close() {
      influxClientShutdown = true;
      log.info('InfluxDB client marked as shutdown');
    },

    _influx: influx
  };
}
