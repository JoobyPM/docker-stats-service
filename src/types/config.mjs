/**
 * Configuration Type Definitions
 * Contains type definitions for application configuration
 * @module types/config
 */

/**
 * Docker configuration
 * @typedef {object} DockerConfig
 * @property {string} socketPath - Path to Docker socket
 * @property {object} stats - Stats processing configuration
 * @property {number} stats.maxBufferSize - Maximum buffer size in bytes
 * @property {number} stats.maxLineSize - Maximum line size in bytes
 * @property {number} stats.parseTimeoutMs - Parse timeout in milliseconds
 * @example
 * const dockerConfig = {
 *   socketPath: '/var/run/docker.sock',
 *   stats: {
 *     maxBufferSize: 1048576, // 1MB
 *     maxLineSize: 102400,    // 100KB
 *     parseTimeoutMs: 30000   // 30 seconds
 *   }
 * };
 */

/**
 * InfluxDB configuration
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
 * @example
 * const influxConfig = {
 *   host: 'localhost',
 *   port: 8086,
 *   protocol: 'http',
 *   username: 'admin',
 *   password: 'admin',
 *   database: 'docker-stats',
 *   retry: {
 *     maxRetries: 5,
 *     initialDelayMs: 1000,
 *     maxDelayMs: 10000,
 *     backoffFactor: 2
 *   }
 * };
 */

/**
 * Batch processing configuration
 * @typedef {object} BatchConfig
 * @property {number} maxSize - Maximum batch size
 * @property {number} maxWaitMs - Maximum wait time in ms
 * @example
 * const batchConfig = {
 *   maxSize: 100,
 *   maxWaitMs: 2000
 * };
 */

/**
 * Application configuration
 * @typedef {object} Config
 * @property {boolean} isDocker - Whether running in Docker
 * @property {string} logLevel - Log level
 * @property {number} shutdownTimeoutMs - Shutdown timeout in ms
 * @property {DockerConfig} docker - Docker configuration
 * @property {InfluxConfig} influx - InfluxDB configuration
 * @property {BatchConfig} batch - Batch configuration
 * @example
 * const config = {
 *   isDocker: false,
 *   logLevel: 'info',
 *   shutdownTimeoutMs: 10000,
 *   docker: { ... },  // DockerConfig
 *   influx: { ... },  // InfluxConfig
 *   batch: { ... }    // BatchConfig
 * };
 */

export const ConfigTypes = {
  /** @type {DockerConfig} */
  DockerConfig: null,
  /** @type {InfluxConfig} */
  InfluxConfig: null,
  /** @type {BatchConfig} */
  BatchConfig: null,
  /** @type {Config} */
  Config: null
};
