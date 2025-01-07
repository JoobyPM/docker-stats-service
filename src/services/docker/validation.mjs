/**
 * Docker Stats Validation
 * Shared validation functions for Docker stats data
 * @module services/docker/validation
 */
/**
 * @typedef {import('@types/docker.mjs').ParsedStats} ParsedStats
 */

import log from 'loglevel';

/**
 * Validates CPU stats structure
 * @param {import('dockerode').CpuStats} cpuStats - CPU stats to validate
 * @returns {{ isValid: boolean, errors: string[] }} Validation result
 */
function validateCpuStats(cpuStats) {
  const errors = [];

  if (!cpuStats?.cpu_usage?.total_usage) {
    errors.push('missing cpu_usage.total_usage');
  }
  if (!cpuStats?.system_cpu_usage) {
    errors.push('missing system_cpu_usage');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates memory stats structure
 * @param {unknown} memStats - Memory stats to validate
 * @returns {{ isValid: boolean, errors: string[] }} Validation result
 */
function validateMemoryStats(memStats) {
  const errors = [];

  if (!memStats) {
    errors.push('missing memory_stats');
    return { isValid: false, errors };
  }

  if (typeof memStats.usage !== 'number') {
    errors.push('invalid memory_stats.usage');
  }
  if (typeof memStats.limit !== 'number') {
    errors.push('invalid memory_stats.limit');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates network stats structure
 * @param {unknown} networks - Network stats to validate
 * @returns {{ isValid: boolean, errors: string[] }} Validation result
 */
function validateNetworkStats(networks) {
  if (networks && typeof networks !== 'object') {
    return { isValid: false, errors: ['invalid networks structure'] };
  }
  return { isValid: true, errors: [] };
}

/**
 * Validates timestamp
 * @param {unknown} timestamp - Timestamp to validate
 * @returns {{ isValid: boolean, errors: string[] }} Validation result
 */
function validateTimestamp(timestamp) {
  if (!timestamp || !Date.parse(timestamp)) {
    return { isValid: false, errors: ['missing or invalid timestamp'] };
  }
  return { isValid: true, errors: [] };
}

/**
 * Validates raw stats data structure
 * @param {unknown} stats - Raw stats data to validate
 * @returns {stats is import('dockerode').ContainerStats} Whether the stats are valid
 */
export function validateStats(stats) {
  if (typeof stats !== 'object' || stats === null) {
    return false;
  }

  const validations = [
    validateTimestamp(stats.read),
    validateCpuStats(stats.cpu_stats),
    validateMemoryStats(stats.memory_stats),
    validateNetworkStats(stats.networks)
  ];

  const errors = validations.flatMap(v => v.errors);

  // Validate precpu_stats structure
  const hasPrecpuStats =
    stats.precpu_stats?.cpu_usage && typeof stats.precpu_stats.cpu_usage.total_usage === 'number';

  if (!hasPrecpuStats) {
    errors.push('missing or invalid precpu_stats.cpu_usage.total_usage structure');
  }

  if (errors.length > 0) {
    log.debug(`Stats validation failed: ${errors.join(', ')}`);
    return false;
  }

  return true;
}

/**
 * Calculates CPU percentage from stats
 * @param {import('dockerode').ContainerStats} stats - Raw Docker stats
 * @returns {number} CPU percentage
 */
function calculateCpuPercent(stats) {
  // noinspection LocalVariableNamingConventionJS
  const { cpu_stats, precpu_stats } = stats;
  const cpuDelta = cpu_stats.cpu_usage.total_usage - (precpu_stats.cpu_usage.total_usage || 0);
  const sysDelta = cpu_stats.system_cpu_usage - (precpu_stats.system_cpu_usage || 0);

  if (sysDelta > 0 && cpuDelta > 0 && precpu_stats.cpu_usage.total_usage > 0) {
    const onlineCPUs = cpu_stats.online_cpus || 1;
    return (cpuDelta / sysDelta) * onlineCPUs * 100;
  }

  return 0;
}

/**
 * Calculates network usage from stats
 * @param {import('dockerode').ContainerStats} stats - Raw Docker stats
 * @returns {{ netIn: number, netOut: number }} Network usage
 */
function calculateNetworkUsage(stats) {
  let netIn = 0;
  let netOut = 0;

  if (stats.networks) {
    for (const iface of Object.keys(stats.networks)) {
      netIn += stats.networks[iface].rx_bytes || 0;
      netOut += stats.networks[iface].tx_bytes || 0;
    }
  }

  return { netIn, netOut };
}

/**
 * Gets a valid timestamp from stats
 * @param {import('dockerode').ContainerStats} stats - Raw Docker stats
 * @returns {Date} Valid timestamp
 */
function getValidTimestamp(stats) {
  const timestamp = new Date(stats.read);
  return Number.isNaN(timestamp.getTime()) || timestamp.getTime() < 0 ? new Date() : timestamp;
}

/**
 * Parses Docker stats into a standardized format
 * @param {import('dockerode').ContainerStats} stats - Raw Docker stats
 * @returns {ParsedStats} Parsed stats
 */
export function parseStats(stats) {
  const cpuPercent = calculateCpuPercent(stats);
  const { netIn, netOut } = calculateNetworkUsage(stats);
  const timestamp = getValidTimestamp(stats);

  return {
    cpuPercent,
    memUsed: stats.memory_stats.usage || 0,
    memTotal: stats.memory_stats.limit || 0,
    netIn,
    netOut,
    timestamp
  };
}

/**
 * Parses a single line of stats data
 * @param {string} line - Raw JSON line to parse
 * @returns {ParsedStats | null} Parsed stats or null if invalid
 */
export function parseLine(line) {
  try {
    const data = JSON.parse(line);
    if (!validateStats(data)) {
      return null;
    }
    return parseStats(data);
  } catch (err) {
    log.debug(`Failed to parse stats line: ${err.message}`);
    return null;
  }
}
