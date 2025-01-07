import log from 'loglevel';

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
  let flushTimeout = null;
  let isShutdown = false;

  /**
   * Writes a batch of points to InfluxDB with retry logic
   * @private
   * @param {Point[]} points - Array of points to write
   * @returns {Promise<boolean>} Success status of the write operation
   */
  async function writeBatch(points) {
    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      try {
        await influx.writePoints(points);
        log.debug(`Successfully wrote batch of ${points.length} points`);
        return true;
      } catch (error) {
        const isLastAttempt = attempt === config.maxRetries - 1;
        if (isLastAttempt) {
          log.error(`Failed to write batch after ${config.maxRetries} attempts:`, error);
          return false;
        }

        const delay = config.retryDelayMs * Math.pow(2, attempt);
        log.warn(
          `Failed to write batch (attempt ${attempt + 1}/${config.maxRetries}), ` +
            `retrying in ${delay}ms: ${error.message}`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return false;
  }

  /**
   * Flushes the current batch to InfluxDB
   * @private
   * @returns {Promise<void>}
   */
  async function flush() {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }

    if (batch.length === 0) {
      return;
    }

    const pointsToWrite = [...batch];
    batch = [];
    lastFlushTime = Date.now();

    try {
      const success = await writeBatch(pointsToWrite);
      if (!success && !isShutdown) {
        // On failure, if we're not shutting down, add points back to the batch
        batch.push(...pointsToWrite);
        scheduleFlush();
      }
    } catch (error) {
      log.error('Error during batch flush:', error);
      if (!isShutdown) {
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
    if (flushTimeout || isShutdown) {
      return;
    }

    const timeUntilFlush = Math.max(0, config.maxWaitMs - (Date.now() - lastFlushTime));

    flushTimeout = setTimeout(() => {
      flushTimeout = null;
      flush().catch(err => log.error('Error in scheduled flush:', err));
    }, timeUntilFlush);
  }

  /**
   * Adds points to the batch
   * @param {Point|Point[]} points - Single point or array of points to add
   * @throws {Error} If the batcher is shutdown
   */
  function add(points) {
    if (isShutdown) {
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
    isShutdown = true;

    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
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
