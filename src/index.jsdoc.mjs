/**
 * @module docker-stats-service
 * @description A lightweight service that collects real-time Docker container metrics and stores them in InfluxDB.
 */

/**
 * Features:
 * - Real-time container metrics collection
 * - Automatic container discovery
 * - InfluxDB storage with batching
 * - Configurable retry mechanisms
 * - Graceful shutdown handling
 */

/**
 * Environment configuration for Docker Stats Service
 * @constant
 * @name ENV
 * @memberof module:docker-stats-service
 * @type {object}
 * @property {boolean} [DOCKER=false] - Running in Docker environment
 * @property {string} [LOG_LEVEL=info] - Logging verbosity (debug,info,warn,error)
 * @property {string} INFLUXDB_HOST - InfluxDB host (required)
 * @property {number} [INFLUXDB_PORT=8086] - InfluxDB port
 * @property {string} [INFLUXDB_PROTOCOL=http] - InfluxDB protocol
 * @property {string} [INFLUXDB_USER=admin] - InfluxDB username
 * @property {string} [INFLUXDB_PASS=admin] - InfluxDB password
 * @property {string} [INFLUXDB_DB=docker-stats] - InfluxDB database name
 * @property {number} [INFLUXDB_RETRY_MAX=5] - Maximum number of retry attempts
 * @property {number} [INFLUXDB_RETRY_DELAY=1000] - Initial retry delay in milliseconds
 * @property {number} [INFLUXDB_RETRY_MAX_DELAY=10000] - Maximum retry delay in milliseconds
 * @property {number} [BATCH_SIZE=100] - Maximum number of points in a metrics batch
 * @property {number} [BATCH_WAIT_MS=2000] - Maximum time to wait before flushing batch
 * @property {number} [SHUTDOWN_TIMEOUT_MS=10000] - Maximum time to wait for graceful shutdown
 */
export const ENV = process.env;

/**
 * Configuration options for metrics batching
 * @typedef {object} BatchOptions
 * @memberof module:docker-stats-service
 * @property {number} [maxSize=1000] - Maximum number of points in a batch
 * @property {number} [maxWaitMs=10000] - Maximum time to wait before flushing batch
 * @property {number} [maxRetries=5] - Maximum number of retry attempts
 * @property {number} [retryDelayMs=1000] - Initial retry delay in milliseconds
 */

/**
 * Configuration options for retry mechanism
 * @typedef {object} RetryOptions
 * @memberof module:docker-stats-service
 * @property {number} [maxRetries=5] - Maximum number of retry attempts
 * @property {number} [initialDelayMs=1000] - Initial retry delay in milliseconds
 * @property {number} [maxDelayMs=10000] - Maximum retry delay in milliseconds
 */

/**
 * Configuration options for graceful shutdown
 * @typedef {object} ShutdownOptions
 * @memberof module:docker-stats-service
 * @property {number} [timeoutMs=10000] - Maximum time to wait for graceful shutdown
 * @property {string[]} [signals=['SIGTERM', 'SIGINT']] - Signals to handle for shutdown
 */
