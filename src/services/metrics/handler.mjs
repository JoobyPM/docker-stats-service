/**
 * Metrics Handler Service
 * Transforms Docker stats into InfluxDB data points and manages metrics batching
 * @module services/metrics/handler
 */

import log from 'loglevel';
import { InfluxDB } from 'influx';
import { createMetricsBatcher } from '../../utils/batch.mjs';
import { createRetryableInflux } from '../../utils/influx.mjs';
import { transformStats, validatePoints } from './transformer.mjs';

/**
 * Creates a new metrics handler instance
 * @param {object} config - Configuration object
 * @param {object} config.influx - InfluxDB configuration
 * @param {string} config.influx.host - InfluxDB host
 * @param {number} config.influx.port - InfluxDB port
 * @param {string} config.influx.protocol - InfluxDB protocol
 * @param {string} config.influx.username - InfluxDB username
 * @param {string} config.influx.password - InfluxDB password
 * @param {string} config.influx.database - InfluxDB database
 * @param {object} config.influx.retry - Retry configuration
 * @param {object} config.batch - Batch configuration
 * @returns {object} Metrics handler functions
 */
export function createMetricsHandler(config) {
  const influx = createRetryableInflux(
    new InfluxDB({
      host: config.influx.host,
      port: config.influx.port,
      protocol: config.influx.protocol,
      username: config.influx.username,
      password: config.influx.password,
      database: config.influx.database
    }),
    config.influx.retry
  );

  const metricsBatcher = createMetricsBatcher(influx, {
    maxSize: config.batch.maxSize,
    maxWaitMs: config.batch.maxWaitMs
  });

  /**
   * Initializes the InfluxDB database
   * @param {string} database - Database name
   * @returns {Promise<void>}
   * @throws {Error} If database initialization fails
   */
  async function initDatabase(database) {
    try {
      const existing = await influx.getDatabaseNames();
      if (!existing.includes(database)) {
        log.info(`Creating InfluxDB database: ${database}`);
        await influx.createDatabase(database);
      } else {
        log.info(`InfluxDB database already exists: ${database}`);
      }
    } catch (err) {
      log.error('Fatal error initializing InfluxDB:', err);
      throw err;
    }
  }

  /**
   * Handles parsed Docker stats and queues them for writing to InfluxDB
   * @param {string} containerId - Container ID
   * @param {string} containerName - Container name
   * @param {import('../../types/docker.mjs').ParsedStats} stats - Parsed Docker stats
   * @returns {Promise<void>}
   */
  async function handleStats(containerId, containerName, stats) {
    const points = transformStats(containerId, containerName, stats);

    if (!validatePoints(points)) {
      throw new Error('Invalid points generated from stats');
    }

    try {
      metricsBatcher.add(points);
      log.debug(
        `container=${containerId} name=${containerName} queued stats at ${stats.timestamp.toISOString()}`
      );
    } catch (err) {
      log.warn(`Failed to queue stats for container=${containerId}:`, err.message);
      throw err; // Let the caller handle the error
    }
  }

  /**
   * Gracefully shuts down the metrics handler
   * @returns {Promise<void>}
   */
  async function shutdown() {
    log.info('Shutting down metrics handler...');
    await metricsBatcher.shutdown();
    await influx.close();
  }

  return {
    initDatabase,
    handleStats,
    shutdown
  };
}
