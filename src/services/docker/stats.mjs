/**
 * Docker Stats Stream Parser
 * Handles buffering and parsing of Docker stats data streams
 * @module services/docker/stats
 */

import log from 'loglevel';
import { MAX_BUFFER_SIZE, MAX_LINE_SIZE, PARSE_TIMEOUT } from '../../types/docker.mjs';

/**
 * Validates the structure of Docker stats object
 * @param {import('../../types/docker.mjs').DockerStats} stats - The stats object to validate
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

/**
 * Manages the stats buffer, handling overflow and size limits
 * @param {string} rawData - Current buffer content
 * @param {Buffer} chunk - New data chunk
 * @param {string} containerId - Container ID for logging
 * @returns {string} Updated buffer content
 */
function manageStatsBuffer(rawData, chunk, containerId) {
  if (rawData.length + chunk.length > MAX_BUFFER_SIZE) {
    log.warn(
      `Buffer overflow for container=${containerId}, resetting buffer (size=${rawData.length})`
    );
    return chunk.toString();
  }
  return rawData + chunk.toString();
}

/**
 * Parses Docker stats into a standardized format
 * @param {import('../../types/docker.mjs').DockerStats} stats - Raw Docker stats
 * @returns {import('../../types/docker.mjs').ParsedStats} Parsed stats
 */
function parseStats(stats) {
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
  const memTotal = memory_stats.limit || 0;

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
  let timestamp = new Date(read);
  if (Number.isNaN(timestamp.getTime()) || timestamp.getTime() < 0) {
    timestamp = new Date();
  }

  return {
    cpuPercent,
    memUsed,
    memTotal,
    netIn,
    netOut,
    timestamp
  };
}

/**
 * Creates a new stats stream context
 * @param {string} containerId - Container ID
 * @param {string} containerName - Container name
 * @returns {import('../../types/docker.mjs').StatsStreamContext} New context object
 */
export function createStreamContext(containerId, containerName) {
  return {
    containerId,
    containerName,
    rawData: '',
    lastValidParse: Date.now()
  };
}

/**
 * Handles incoming stats data chunks
 * @param {Buffer} chunk - Raw data chunk from stream
 * @param {import('../../types/docker.mjs').StatsStreamContext} context - Current stream context
 * @param {function(string, string, import('../../types/docker.mjs').ParsedStats): Promise<void>} onStats - Callback for parsed stats
 * @param {function(string): void} onError - Callback for stream errors
 * @returns {import('../../types/docker.mjs').StatsStreamContext} Updated context
 */
export function handleStatsData(chunk, context, onStats, onError) {
  const { containerId, containerName, rawData: currentData, lastValidParse } = context;

  let rawData = manageStatsBuffer(currentData, chunk, containerId);
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
      if (!jsonLine) continue;

      const stats = JSON.parse(jsonLine);
      const validationErrors = validateStatsStructure(stats);

      if (validationErrors.length > 0) {
        throw new Error(
          `Invalid stats structure: ${validationErrors.join(', ')} actual json ${JSON.stringify(stats)}`
        );
      }

      const parsedStats = parseStats(stats);
      onStats(containerId, containerName, parsedStats)
        .then(() => {
          newLastValidParse = Date.now();
        })
        .catch(err => {
          onError(`Error handling stats for container=${containerId}: ${err.message}`);
        });
    } catch (parseErr) {
      onError(`Failed to parse Docker stats for container=${containerId}: ${parseErr.message}`);

      // Check for stream reset condition
      if (Date.now() - lastValidParse > PARSE_TIMEOUT) {
        onError(
          `No valid stats parsed for ${PARSE_TIMEOUT}ms, resetting stream for container=${containerId}`
        );
        return null; // Signal stream reset needed
      }
    }
  }

  return { ...context, rawData, lastValidParse: newLastValidParse };
}
