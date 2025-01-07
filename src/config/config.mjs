/**
 * Configuration management for the Docker Stats Service
 * Centralizes all environment variable handling and configuration validation
 * @module config
 */

import assert from 'node:assert';
import log from 'loglevel';

// Environment variable defaults and parsing
const {
  DOCKER = 'false',
  LOG_LEVEL = 'info',
  INFLUXDB_HOST,
  INFLUXDB_PORT = 8086,
  INFLUXDB_PROTOCOL = 'http',
  INFLUXDB_USER = 'admin',
  INFLUXDB_PASS = 'admin',
  INFLUXDB_DB = 'docker-stats',
  INFLUXDB_RETRY_MAX = '5',
  INFLUXDB_RETRY_DELAY = '1000',
  INFLUXDB_RETRY_MAX_DELAY = '10000',
  SHUTDOWN_TIMEOUT_MS = '10000',
  BATCH_SIZE = '100',
  BATCH_WAIT_MS = '2000',
  // Docker-specific configuration
  DOCKER_SOCKET_PATH = '/var/run/docker.sock',
  STATS_BUFFER_SIZE = '1048576', // 1MB max buffer size
  STATS_LINE_SIZE = '102400', // 100KB max line size
  STATS_PARSE_TIMEOUT = '30000' // 30 seconds without valid parse triggers reset
} = process.env;

/**
 * @typedef {object} DockerConfig
 * @property {string} socketPath - Path to Docker socket
 * @property {object} stats - Stats processing configuration
 * @property {number} stats.maxBufferSize - Maximum buffer size in bytes
 * @property {number} stats.maxLineSize - Maximum line size in bytes
 * @property {number} stats.parseTimeoutMs - Parse timeout in milliseconds
 */

/**
 * @typedef {object} InfluxConfig
 * @property {string} host - InfluxDB host
 * @property {number} port - InfluxDB port
 * @property {string} protocol - InfluxDB protocol (http/https)
 * @property {string} username - InfluxDB username
 * @property {string} password - InfluxDB password
 * @property {string} database - InfluxDB database name
 * @property {object} retry - Retry configuration
 * @property {number} retry.maxRetries - Maximum number of retries
 * @property {number} retry.initialDelayMs - Initial retry delay in ms
 * @property {number} retry.maxDelayMs - Maximum retry delay in ms
 * @property {number} retry.backoffFactor - Backoff factor for retries
 */

/**
 * @typedef {object} BatchConfig
 * @property {number} maxSize - Maximum batch size
 * @property {number} maxWaitMs - Maximum wait time in ms
 */

/**
 * @typedef {object} Config
 * @property {boolean} isDocker - Whether running in Docker
 * @property {string} logLevel - Log level
 * @property {number} shutdownTimeoutMs - Shutdown timeout in ms
 * @property {DockerConfig} docker - Docker configuration
 * @property {InfluxConfig} influx - InfluxDB configuration
 * @property {BatchConfig} batch - Batch configuration
 */

/**
 * Validates and initializes the configuration
 * @returns {Config} The validated configuration object
 * @throws {Error} If configuration is invalid
 */
function initConfig() {
  // Validate log level
  const logLevel = LOG_LEVEL.toLowerCase();
  assert(
    ['trace', 'debug', 'info', 'warn', 'error', 'silent'].includes(logLevel),
    'Invalid log level'
  );

  // Setup loglevel
  log.setLevel(logLevel);

  // Decide which host to connect to if running in Docker
  const isDocker = DOCKER === 'true';
  const localHost = isDocker ? 'host.docker.internal' : 'localhost';

  // Use env-provided INFLUXDB_HOST or fallback
  const influxHost = INFLUXDB_HOST || localHost;

  return {
    isDocker,
    logLevel,
    shutdownTimeoutMs: parseInt(SHUTDOWN_TIMEOUT_MS, 10),
    docker: {
      socketPath: DOCKER_SOCKET_PATH,
      stats: {
        maxBufferSize: parseInt(STATS_BUFFER_SIZE, 10),
        maxLineSize: parseInt(STATS_LINE_SIZE, 10),
        parseTimeoutMs: parseInt(STATS_PARSE_TIMEOUT, 10)
      }
    },
    influx: {
      host: influxHost,
      port: parseInt(INFLUXDB_PORT, 10),
      protocol: INFLUXDB_PROTOCOL,
      username: INFLUXDB_USER,
      password: INFLUXDB_PASS,
      database: INFLUXDB_DB,
      retry: {
        maxRetries: parseInt(INFLUXDB_RETRY_MAX, 10),
        initialDelayMs: parseInt(INFLUXDB_RETRY_DELAY, 10),
        maxDelayMs: parseInt(INFLUXDB_RETRY_MAX_DELAY, 10),
        backoffFactor: 2
      }
    },
    batch: {
      maxSize: parseInt(BATCH_SIZE, 10),
      maxWaitMs: parseInt(BATCH_WAIT_MS, 10)
    }
  };
}

export const config = initConfig();
