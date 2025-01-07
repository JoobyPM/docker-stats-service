// noinspection ExceptionCaughtLocallyJS

/**
 * Docker Stats Service - Main Application
 *
 * This service collects real-time Docker container metrics and stores them in InfluxDB.
 * It automatically discovers containers, tracks their resource usage, and provides
 * detailed metrics that can be visualized through Grafana.
 *
 * Features:
 * - Automatic container discovery
 * - Real-time metrics collection
 * - Efficient metrics batching
 * - Graceful shutdown handling
 * - Retry mechanisms for resilience
 * @module docker-stats-service
 */

import assert from 'node:assert';
import Docker from 'dockerode';
import { InfluxDB } from 'influx';
import log from 'loglevel';
import { createRetryableInflux } from './utils/influx.mjs';
import { createGracefulShutdown } from './utils/shutdown.mjs';
import { createMetricsBatcher } from './utils/batch.mjs';

/**
 * @typedef {object} DockerStats
 * @property {object} cpu_stats - CPU statistics
 * @property {object} cpu_stats.cpu_usage - CPU usage information
 * @property {number} cpu_stats.cpu_usage.total_usage - Total CPU time consumed
 * @property {number} cpu_stats.system_cpu_usage - Total system CPU time
 * @property {number} [cpu_stats.online_cpus] - Number of CPUs available
 * @property {object} precpu_stats - Previous CPU statistics
 * @property {object} memory_stats - Memory statistics
 * @property {number} memory_stats.usage - Current memory usage
 * @property {number} memory_stats.limit - Memory limit
 * @property {object} [networks] - Network statistics per interface
 * @property {string} read - Timestamp of the stats
 */

// ------------------------------------------------------------------
// 0) Environment-based configuration
// ------------------------------------------------------------------
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
  BATCH_WAIT_MS = '2000'
} = process.env;

/** @type {"trace" | "debug" | "info" | "warn" | "error" | "silent"} */
const LowercasedLogLevel = LOG_LEVEL.toLowerCase();

// Assert logLevel is valid
assert(
  ['trace', 'debug', 'info', 'warn', 'error', 'silent'].includes(LowercasedLogLevel),
  'Invalid log level'
);

// Setup loglevel
log.setLevel(LowercasedLogLevel);

// Decide which host to connect to if running in Docker
const isDocker = DOCKER === 'true';
const localHost = isDocker ? 'host.docker.internal' : 'localhost';

// Use env-provided INFLUXDB_HOST or fallback
const influxHost = INFLUXDB_HOST || localHost;

// Initialize graceful shutdown handler
const shutdown = createGracefulShutdown({ timeout: parseInt(SHUTDOWN_TIMEOUT_MS, 10) });

// ------------------------------------------------------------------
// 1) Initialize Docker & Influx with retry options
// ------------------------------------------------------------------
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const influx = createRetryableInflux(
  new InfluxDB({
    host: influxHost,
    port: INFLUXDB_PORT,
    protocol: INFLUXDB_PROTOCOL,
    username: INFLUXDB_USER,
    password: INFLUXDB_PASS,
    database: INFLUXDB_DB
  }),
  {
    maxRetries: parseInt(INFLUXDB_RETRY_MAX, 10),
    initialDelayMs: parseInt(INFLUXDB_RETRY_DELAY, 10),
    maxDelayMs: parseInt(INFLUXDB_RETRY_MAX_DELAY, 10),
    backoffFactor: 2
  }
);

// Initialize metrics batcher
const metricsBatcher = createMetricsBatcher(influx, {
  maxSize: parseInt(BATCH_SIZE, 10),
  maxWaitMs: parseInt(BATCH_WAIT_MS, 10)
});

// ------------------------------------------------------------------
// 2) Ensure InfluxDB database with retries
// ------------------------------------------------------------------
/**
 * Initializes the InfluxDB database with retry support
 * @async
 * @throws {Error} If database initialization fails after retries
 * @returns {Promise<void>}
 */
async function initInfluxDB() {
  try {
    const existing = await influx.getDatabaseNames();
    if (!existing.includes(INFLUXDB_DB)) {
      log.info(`Creating InfluxDB database: ${INFLUXDB_DB}`);
      await influx.createDatabase(INFLUXDB_DB);
    } else {
      log.info(`InfluxDB database already exists: ${INFLUXDB_DB}`);
    }
  } catch (err) {
    log.error('Fatal error initializing InfluxDB:', err);
    throw err;
  }
}

// ------------------------------------------------------------------
// 3) Handle Docker stats and write to Influx with retries
// ------------------------------------------------------------------
/**
 * Processes Docker stats and writes them to InfluxDB via the metrics batcher
 * @async
 * @param {string} containerId - Docker container ID
 * @param {string} containerName - Human-readable container name
 * @param {DockerStats} stats - Container statistics from Docker
 * @returns {Promise<void>}
 * @throws {Error} If stats processing fails
 */
async function handleDockerStats(containerId, containerName, stats) {
  // Negative-space checks
  assert(stats, 'No stats object received');
  assert(stats.cpu_stats, 'No cpu_stats field in Docker stats');
  assert(stats.precpu_stats, 'No precpu_stats field in Docker stats');
  assert(stats.memory_stats, 'No memory_stats field in Docker stats');

  const { cpu_stats, precpu_stats, memory_stats, networks, read } = stats;

  // CPU usage calculation
  const cpuDelta = cpu_stats.cpu_usage.total_usage - (precpu_stats.cpu_usage.total_usage || 0);
  const sysDelta = cpu_stats.system_cpu_usage - (precpu_stats.system_cpu_usage || 0);
  let cpuPercent = 0;

  // Only calculate CPU percent if we have valid deltas
  // This skips the first reading where precpu values might be 0
  if (sysDelta > 0 && cpuDelta > 0 && precpu_stats.cpu_usage.total_usage > 0) {
    const onlineCPUs = cpu_stats.online_cpus || 1;
    cpuPercent = (cpuDelta / sysDelta) * onlineCPUs * 100;
  }

  // Memory usage
  const memUsed = memory_stats.usage || 0;
  const memLimit = memory_stats.limit || 0;

  // Network usage
  let netIn = 0;
  let netOut = 0;
  if (networks) {
    for (const iface of Object.keys(networks)) {
      netIn += networks[iface].rx_bytes || 0;
      netOut += networks[iface].tx_bytes || 0;
    }
  }

  // Validate timestamp from Docker
  let measurementTime = new Date(read);
  if (Number.isNaN(measurementTime.getTime()) || measurementTime.getTime() < 0) {
    measurementTime = new Date();
  }

  const points = [
    {
      measurement: 'docker_stats',
      tags: {
        container_id: containerId,
        container_name: containerName
      },
      fields: {
        cpu_percent: cpuPercent,
        mem_used: memUsed,
        mem_total: memLimit,
        net_in_bytes: netIn,
        net_out_bytes: netOut
      },
      timestamp: measurementTime
    }
  ];

  try {
    metricsBatcher.add(points);
    log.debug(
      `container=${containerId} name=${containerName} queued stats at ${measurementTime.toISOString()}`
    );
  } catch (err) {
    if (!shutdown.isShuttingDown) {
      log.warn(`Failed to queue stats for container=${containerId}:`, err.message);
    }
  }
}

// ------------------------------------------------------------------
// 4) Track active stats streams in a Map, so we can close them on stop
// ------------------------------------------------------------------
const statsStreams = new Map(); // Map<containerId, statsStreamObject>

// ------------------------------------------------------------------
// 5) Attach to Docker stats stream for a given container
// ------------------------------------------------------------------
/**
 * Attaches to a container's stats stream and processes the metrics
 * @param {string} containerId - Docker container ID
 * @param {string} containerName - Human-readable container name
 */
function watchContainerStats(containerId, containerName) {
  if (shutdown.isShuttingDown) {
    log.info(`Skipping container watch during shutdown: ${containerId}`);
    return;
  }

  // If we already have a stats stream for this container, do nothing
  if (statsStreams.has(containerId)) {
    log.debug(`Already watching container=${containerId}, skipping re-watch`);
    return;
  }

  const container = docker.getContainer(containerId);

  container.stats({ stream: true }, (err, statsStream) => {
    if (err) {
      log.error(`Error opening stats stream for ${containerId}:`, err);
      return;
    }

    // Keep track of the stream, so we can close it later
    statsStreams.set(containerId, statsStream);

    let streamContext = {
      containerId,
      containerName,
      rawData: '',
      lastValidParse: Date.now()
    };

    statsStream.on('data', chunk => {
      streamContext = handleStatsData(chunk, streamContext);
    });

    statsStream.on('end', () => {
      log.info(`Stats stream ended for container=${containerId} name=${containerName}`);
      statsStreams.delete(containerId);
    });

    statsStream.on('error', streamErr => {
      log.error(
        `Stats stream error for container=${containerId} name=${containerName}:`,
        streamErr
      );
      statsStreams.delete(containerId);
    });
  });
}

/**
 * Manages the stats buffer, handling overflow and size limits
 * @param {string} rawData - Current buffer content
 * @param {Buffer} chunk - New data chunk
 * @param {string} containerId - Container ID for logging
 * @param {number} maxBufferSize - Maximum allowed buffer size
 * @returns {string} Updated buffer content
 */
function manageStatsBuffer(rawData, chunk, containerId, maxBufferSize) {
  if (rawData.length + chunk.length > maxBufferSize) {
    log.warn(
      `Buffer overflow for container=${containerId}, resetting buffer (size=${rawData.length})`
    );
    return chunk.toString();
  }
  return rawData + chunk.toString();
}

/**
 * Processes a single line of stats data
 * @param {string} jsonLine - Raw JSON line to process
 * @param {string} containerId - Container ID
 * @param {string} containerName - Container name
 * @returns {Promise<void>}
 */
async function processStatsLine(jsonLine, containerId, containerName) {
  if (!jsonLine) return;

  const parsedStats = JSON.parse(jsonLine);

  // Negative space validation for required fields
  if (!parsedStats || typeof parsedStats !== 'object') {
    throw new Error('Stats is not an object');
  }

  // Validate essential stats structure
  const validationErrors = validateStatsStructure(parsedStats);
  if (validationErrors.length > 0) {
    throw new Error(
      `Invalid stats structure: ${validationErrors.join(', ')} actual json ${JSON.stringify(parsedStats)}`
    );
  }

  await handleDockerStats(containerId, containerName, parsedStats);
}

/**
 * Handles the stats stream data events
 * @param {Buffer} chunk - Data chunk from stream
 * @param {object} context - Processing context
 * @param {string} context.containerId - Container ID
 * @param {string} context.containerName - Container name
 * @param {string} context.rawData - Current buffer content
 * @param {number} context.lastValidParse - Timestamp of last valid parse
 * @returns {object} Updated context
 */
function handleStatsData(chunk, context) {
  const { containerId, containerName, rawData: currentData, lastValidParse } = context;
  const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB max buffer size
  const MAX_LINE_SIZE = 100 * 1024; // 100KB max line size
  const PARSE_TIMEOUT = 30000; // 30 seconds without valid parse triggers reset

  if (shutdown.isShuttingDown) return context;

  let rawData = manageStatsBuffer(currentData, chunk, containerId, MAX_BUFFER_SIZE);
  let newLastValidParse = lastValidParse;

  // Process all complete lines in the buffer
  while (rawData.length > 0) {
    const boundary = rawData.indexOf('\n');
    if (boundary === -1) {
      // No complete line yet, check line size limit
      if (rawData.length > MAX_LINE_SIZE) {
        log.warn(
          `Line size limit exceeded for container=${containerId}, discarding (size=${rawData.length})`
        );
        rawData = '';
      }
      break;
    }

    const jsonLine = rawData.slice(0, boundary).trim();
    rawData = rawData.slice(boundary + 1);

    try {
      processStatsLine(jsonLine, containerId, containerName)
        .then(() => {
          newLastValidParse = Date.now();
        })
        .catch(err => {
          log.error(`Error handling stats for container=${containerId}:`, err);
        });
    } catch (parseErr) {
      log.warn(`Failed to parse Docker stats for container=${containerId}: ${parseErr.message}`);

      // Check for stream reset condition
      if (Date.now() - lastValidParse > PARSE_TIMEOUT) {
        log.error(
          `No valid stats parsed for ${PARSE_TIMEOUT}ms, resetting stream for container=${containerId}`
        );
        unwatchContainerStats(containerId);
        watchContainerStats(containerId, containerName);
        return context;
      }
    }
  }

  return { ...context, rawData, lastValidParse: newLastValidParse };
}

/**
 * Validates the structure of Docker stats object
 * @param {DockerStats} stats - The stats object to validate
 * @returns {string[]} Array of validation errors, empty if valid
 */
function validateStatsStructure(stats) {
  const errors = [];

  // Essential fields
  if (!stats.read || !Date.parse(stats.read)) {
    errors.push('missing or invalid timestamp');
  }

  // CPU stats validation
  if (!stats.cpu_stats?.cpu_usage?.total_usage) {
    errors.push('missing cpu_usage.total_usage');
  }
  if (!stats.cpu_stats?.system_cpu_usage) {
    errors.push('missing system_cpu_usage');
  }

  // For precpu_stats, we only validate structure but allow 0 values
  // This handles the first stats event when there's no previous CPU data
  if (
    !stats.precpu_stats?.cpu_usage ||
    typeof stats.precpu_stats.cpu_usage.total_usage !== 'number'
  ) {
    errors.push('missing or invalid precpu_stats.cpu_usage.total_usage structure');
  }

  // Memory stats validation
  if (!stats.memory_stats) {
    errors.push('missing memory_stats');
  } else {
    if (typeof stats.memory_stats.usage !== 'number') {
      errors.push('invalid memory_stats.usage');
    }
    if (typeof stats.memory_stats.limit !== 'number') {
      errors.push('invalid memory_stats.limit');
    }
  }

  // Network stats validation (optional)
  if (stats.networks && typeof stats.networks !== 'object') {
    errors.push('invalid networks structure');
  }

  return errors;
}

// ------------------------------------------------------------------
// 6) Stop watching stats for a given container (close the stream)
// ------------------------------------------------------------------
/**
 * Stops watching a container's stats and cleans up the stream
 * @param {string} containerId - Docker container ID
 */
function unwatchContainerStats(containerId) {
  const existingStream = statsStreams.get(containerId);
  if (existingStream) {
    log.info(`Closing stats stream for container=${containerId}`);
    existingStream.destroy(); // close the underlying stream
    statsStreams.delete(containerId);
  }
}

// ------------------------------------------------------------------
// 7) Listen to Docker events for container start/stop
// ------------------------------------------------------------------
/**
 * Sets up Docker event monitoring for container lifecycle events
 * Handles container start, stop, die, and kill events
 */
function watchDockerEvents() {
  docker.getEvents(
    {
      filters: JSON.stringify({
        type: ['container']
      })
    },
    (err, eventsStream) => {
      if (err) {
        log.error('Error listening to Docker events:', err);
        return;
      }

      // Register event stream for cleanup
      shutdown.register('docker-events', async () => {
        if (typeof eventsStream?.destroy === 'function') {
          eventsStream?.destroy();
        }
      });

      eventsStream.on('data', async chunk => {
        if (shutdown.isShuttingDown) return;

        try {
          const event = JSON.parse(chunk.toString());
          const { status, id } = event;
          if (!status || !id) return;

          if (status === 'start') {
            log.info(`Container started: ${id}`);
            try {
              const container = docker.getContainer(id);
              const info = await container.inspect();

              // Negative space check for required data
              if (!info || !info.Name) {
                log.warn(`Container ${id} inspection returned invalid data, skipping`);
                return;
              }

              // Remove leading slash from container name
              const containerName = info.Name.replace(/^\//, '');

              // Start watching container stats
              log.debug(`Starting stats collection for container=${id} name=${containerName}`);
              watchContainerStats(id, containerName);
            } catch (err2) {
              if (err2.statusCode === 404) {
                log.warn(`Container ${id} no longer exists, skipping stats collection`);
              } else {
                log.error(`Error inspecting container ${id}:`, err2);
              }
            }
          } else if (status === 'stop' || status === 'die') {
            log.info(`Container stopping: ${id}, status=${status}`);
            unwatchContainerStats(id);
          } else if (status === 'kill') {
            log.info(`Container killed: ${id}`);
            unwatchContainerStats(id);
          }
        } catch (parseErr) {
          log.error('Failed to parse Docker event:', parseErr);
        }
      });

      eventsStream.on('error', streamErr => {
        log.error('Docker events stream error:', streamErr);
      });

      eventsStream.on('end', () => {
        log.info('Docker events stream ended');
      });
    }
  );
}

// ------------------------------------------------------------------
// 8) Register shutdown handlers
// ------------------------------------------------------------------
/**
 * Registers handlers for graceful shutdown
 * Ensures proper cleanup of resources and data flushing
 */
function registerShutdownHandlers() {
  // Close all container stat streams
  shutdown.register('container-streams', async () => {
    log.info(`Closing ${statsStreams.size} container stat streams...`);
    for (const [containerId, stream] of statsStreams) {
      try {
        stream.destroy();
        log.debug(`Closed stream for container: ${containerId}`);
      } catch (err) {
        log.error(`Error closing stream for container ${containerId}:`, err);
      }
    }
    statsStreams.clear();
  });

  // Flush remaining metrics and close InfluxDB connection
  shutdown.register('metrics-flush', async () => {
    log.info('Flushing remaining metrics...');
    await metricsBatcher.shutdown();
    log.info('Closing InfluxDB connection...');
    await influx.close();
  });
}

// ------------------------------------------------------------------
// 9) Main bootstrap
// ------------------------------------------------------------------
/**
 * Main application bootstrap
 * Initializes services, sets up monitoring, and starts the application
 * @async
 */
(async function main() {
  try {
    // Initialize shutdown handler
    registerShutdownHandlers();
    shutdown.init();

    // Validate Docker access first
    await validateDockerAccess();

    // Initialize services
    await initInfluxDB();

    // Watch running containers
    const containers = await docker.listContainers();
    containers.forEach(info => {
      assert(info.Id, 'Container info does not have an Id');
      const containerName = info.Names[0]?.replace('/', '') || 'unknown_container';
      watchContainerStats(info.Id, containerName);
    });

    // Watch for container events
    watchDockerEvents();

    log.info('Docker stats service is running. Press Ctrl+C to stop.');
  } catch (err) {
    log.error('Fatal error initializing:', err);
    if (err.message.includes('Permission denied')) {
      log.error('Please check Docker socket permissions and container configuration');
    }
    process.exit(1);
  }
})();

// ------------------------------------------------------------------
// 10) Validates Docker socket access and permissions
// ------------------------------------------------------------------
/**
 * Validates Docker socket access and permissions
 * @async
 * @throws {Error} If Docker socket is not accessible or has incorrect permissions
 * @returns {Promise<void>}
 */
async function validateDockerAccess() {
  try {
    // Try to list containers as a basic access test
    await docker.ping();
    log.info('Docker socket access verified');

    // Test event stream access
    const testStream = await docker.getEvents({
      filters: { type: ['container'] },
      since: 0,
      until: 1
    });

    await new Promise((resolve, reject) => {
      testStream.on('error', reject);
      testStream.on('end', resolve);
      // Ensure we don't hang
      setTimeout(() => {
        // noinspection JSUnresolvedReference
        testStream?.destroy();
        resolve();
      }, 1000);
    });

    log.info('Docker event stream access verified');
  } catch (err) {
    if (err.code === 'EACCES') {
      throw new Error(
        'Permission denied accessing Docker socket. Please ensure:\n' +
          '1. The socket is mounted: -v /var/run/docker.sock:/var/run/docker.sock\n' +
          '2. The socket has correct permissions: sudo chmod 666 /var/run/docker.sock\n' +
          '3. The container user has necessary group membership'
      );
    } else if (err.code === 'ENOENT') {
      throw new Error(
        'Docker socket not found. Please ensure:\n' +
          '1. Docker is running on the host\n' +
          '2. The socket is mounted correctly in docker-compose.yml'
      );
    } else {
      throw new Error(`Docker access validation failed: ${err.message}`);
    }
  }
}
