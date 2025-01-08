/**
 * Metrics Batcher
 * Provides efficient batching for InfluxDB writes
 * @module utils/batch
 */

import log from 'loglevel';
import { retryWithBackoff } from './common.mjs';

/**
 * @typedef {object} BatchOptions
 * @property {number} [maxSize=1000] - Maximum number of points in a batch
 * @property {number} [maxWaitMs=10000] - Maximum time to wait before flushing
 * @property {number} [maxRetries=3] - Maximum retries for failed batch writes
 * @property {number} [retryDelayMs=1000] - Initial delay between retries
 */

/**
 * @typedef {object} Point
 * @property {string} measurement - The measurement name
 * @property {object} tags - Key-value pairs for tagging the measurement
 * @property {object} fields - Key-value pairs of the actual measurement data
 * @property {Date|string|number} [timestamp] - Optional timestamp for the measurement
 */

/**
 * @typedef {object} MetricsBatcher
 * @property {Function} add - Adds points to the batch
 * @property {Function} shutdown - Gracefully shuts down the batcher
 */

const DEFAULT_BATCH_OPTIONS = {
  maxSize: 1000, // Maximum number of points in a batch
  maxWaitMs: 10000, // Maximum time to wait before flushing
  maxRetries: 3, // Maximum retries for failed batch writes
  retryDelayMs: 1000 // Initial delay between retries
};

/**
 * Creates a metrics batcher for efficient InfluxDB writes
 * @param {object} influx - InfluxDB client instance with writePoints method
 * @param {BatchOptions} [options] - Configuration options for the batcher
 * @returns {MetricsBatcher} A metrics batcher instance
 * @example
 * const batcher = createMetricsBatcher(influxClient, {
 *   maxSize: 500,
 *   maxWaitMs: 5000
 * });
 *
 * // Add single point
 * batcher.add({
 *   measurement: 'cpu',
 *   tags: { host: 'server1' },
 *   fields: { value: 0.64 }
 * });
 *
 * // Add multiple points
 * batcher.add([
 *   { measurement: 'cpu', tags: { host: 'server1' }, fields: { value: 0.64 } },
 *   { measurement: 'memory', tags: { host: 'server1' }, fields: { used: 4096 } }
 * ]);
 *
 * // Graceful shutdown
 * await batcher.shutdown();
 */
export function createMetricsBatcher(influx, options = {}) {
  const config = { ...DEFAULT_BATCH_OPTIONS, ...options };
  let batch = [];
  let lastFlushTime = Date.now();
  let scheduledFlushTimeout = null;
  let batcherIsShutdown = false;

  /**
   * Writes a batch of points to InfluxDB with retry logic
   * @private
   * @param {Point[]} points - Array of points to write
   * @returns {Promise<boolean>} Success status of the write operation
   */
  async function writeBatch(points) {
    try {
      await retryWithBackoff(() => influx.writePoints(points), {
        maxRetries: config.maxRetries,
        initialDelayMs: config.retryDelayMs,
        maxDelayMs: config.retryDelayMs * Math.pow(2, config.maxRetries),
        shouldRetry: (error, attempt) => {
          log.warn(
            `Failed to write batch (attempt ${attempt}/${config.maxRetries}): ${error.message}`
          );
          return true;
        }
      });
      log.debug(`Successfully wrote batch of ${points.length} points`);
      return true;
    } catch (error) {
      log.error(`Failed to write batch after ${config.maxRetries} attempts:`, error);
      return false;
    }
  }

  /**
   * Flushes the current batch to InfluxDB
   * @private
   * @returns {Promise<void>}
   */
  async function flush() {
    if (scheduledFlushTimeout) {
      clearTimeout(scheduledFlushTimeout);
      scheduledFlushTimeout = null;
    }

    if (batch.length === 0) {
      return;
    }

    const pointsToWrite = [...batch];
    batch = [];
    lastFlushTime = Date.now();

    try {
      const success = await writeBatch(pointsToWrite);
      if (!success && !batcherIsShutdown) {
        // On failure, if we're not shutting down, add points back to the batch
        batch.push(...pointsToWrite);
        scheduleFlush();
      }
    } catch (error) {
      log.error('Error during batch flush:', error);
      if (!batcherIsShutdown) {
        batch.push(...pointsToWrite);
        scheduleFlush();
      }
    }
  }

  /**
   * Schedules the next batch flush
   * @private
   */
  function scheduleFlush() {
    if (scheduledFlushTimeout || batcherIsShutdown) {
      return;
    }

    const timeUntilFlush = Math.max(0, config.maxWaitMs - (Date.now() - lastFlushTime));

    scheduledFlushTimeout = setTimeout(() => {
      scheduledFlushTimeout = null;
      flush().catch(err => log.error('Error in scheduled flush:', err));
    }, timeUntilFlush);
  }

  /**
   * Adds points to the batch
   * @param {Point|Point[]} points - Single point or array of points to add
   * @throws {Error} If the batcher is shutdown
   */
  function add(points) {
    if (batcherIsShutdown) {
      log.warn('Attempted to add points after batcher shutdown');
      return;
    }

    // Ensure points is an array
    const pointsArray = Array.isArray(points) ? points : [points];
    if (pointsArray.length === 0) {
      return;
    }

    batch.push(...pointsArray);

    // If we've exceeded maxSize, flush immediately
    if (batch.length >= config.maxSize) {
      flush().catch(err => log.error('Error in size-triggered flush:', err));
      return;
    }

    // Schedule a flush if we haven't already
    scheduleFlush();
  }

  /**
   * Gracefully shuts down the batcher
   * @returns {Promise<void>} Resolves when shutdown is complete
   */
  async function shutdown() {
    batcherIsShutdown = true;

    if (scheduledFlushTimeout) {
      clearTimeout(scheduledFlushTimeout);
      scheduledFlushTimeout = null;
    }

    if (batch.length > 0) {
      log.info(`Flushing remaining ${batch.length} points during shutdown`);
      await flush();
    }
  }

  return {
    add,
    shutdown
  };
}
