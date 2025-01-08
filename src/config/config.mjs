/**
 * Configuration management for the Docker Stats Service
 * Centralizes all environment variable handling and configuration validation
 * @module config
 */

import assert from 'node:assert';
import log from 'loglevel';

const LOG_LEVEL_MAP = ['trace', 'debug', 'info', 'warn', 'error', 'silent'];

// Environment variable defaults and parsing
const {
  DOCKER = 'false',
  LOG_LEVEL = 'info',
  INFLUXDB_HOST,
  INFLUXDB_PORT = '8086',
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
  STATS_PARSE_TIMEOUT = '30000', // 30 seconds without valid parse triggers reset
  STATS_FIELDS = '' // Empty means all fields, 'ESSENTIAL' for core subset, or comma-separated list
} = process.env;

// Define essential fields that should be included when STATS_FIELDS=ESSENTIAL
const ESSENTIAL_FIELDS = ['cpu_percent', 'mem_used', 'mem_total', 'net_in_bytes', 'net_out_bytes'];

/**
 * @typedef {object} DockerConfig
 * @property {string} socketPath - Path to Docker socket
 * @property {object} stats - Stats processing configuration
 * @property {number} stats.maxBufferSize - Maximum buffer size in bytes
 * @property {number} stats.maxLineSize - Maximum line size in bytes
 * @property {number} stats.parseTimeoutMs - Parse timeout in milliseconds
 * @property {string[]} stats.fields - Fields to record (empty array means all fields)
 */

/**
 * @typedef {object} InfluxConfig
 * @property {string} host - InfluxDB host
 * @property {number} port - InfluxDB port
 * @property {('http'|'https')} protocol - InfluxDB protocol
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
 * Parses the STATS_FIELDS environment variable
 * @returns {string[]} Array of field names to record
 */
function parseStatsFields() {
  if (!STATS_FIELDS) {
    return []; // Empty array means record all fields
  }

  if (STATS_FIELDS.toUpperCase() === 'ESSENTIAL') {
    return ESSENTIAL_FIELDS;
  }

  // Parse and validate field names
  const fields = new Set(
    STATS_FIELDS.split(',')
      .map(field => field.trim())
      .filter(field => {
        if (!field) {
          log.debug('Empty field name found in STATS_FIELDS, ignoring');
          return false;
        }
        return true;
      })
  );

  // Check for duplicates
  if (fields.size < STATS_FIELDS.split(',').length) {
    log.debug('Duplicate field names found in STATS_FIELDS, they will be ignored');
  }

  return Array.from(fields);
}

/**
 * Validates and initializes the configuration
 * @returns {Config} The validated configuration object
 * @throws {Error} If configuration is invalid
 */
function initConfig() {
  // Validate log level
  /** @type {"trace" | "debug" | "info" | "warn" | "error" | "silent"} */
  const logLevel = LOG_LEVEL.toLowerCase();
  assert(LOG_LEVEL_MAP.includes(logLevel), 'Invalid log level');

  // Setup loglevel
  log.setLevel(logLevel);

  // Decide which host to connect to if running in Docker
  const isDocker = DOCKER === 'true';
  const localHost = isDocker ? 'host.docker.internal' : 'localhost';

  // Use env-provided INFLUXDB_HOST or fallback
  const influxHost = INFLUXDB_HOST || localHost;

  // Parse numeric values
  const influxPort = parseInt(INFLUXDB_PORT, 10);
  assert(!Number.isNaN(influxPort), 'Invalid INFLUXDB_PORT value');

  return {
    isDocker,
    logLevel,
    shutdownTimeoutMs: parseInt(SHUTDOWN_TIMEOUT_MS, 10),
    docker: {
      socketPath: DOCKER_SOCKET_PATH,
      stats: {
        maxBufferSize: parseInt(STATS_BUFFER_SIZE, 10),
        maxLineSize: parseInt(STATS_LINE_SIZE, 10),
        parseTimeoutMs: parseInt(STATS_PARSE_TIMEOUT, 10),
        fields: parseStatsFields()
      }
    },
    influx: {
      host: influxHost,
      port: influxPort,
      protocol: /** @type {('http'|'https')} */ (INFLUXDB_PROTOCOL),
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
