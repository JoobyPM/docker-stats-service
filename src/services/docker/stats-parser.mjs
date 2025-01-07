/**
 * Docker Stats Stream Parser
 * Pure functions for parsing and validating Docker stats data
 * @module services/docker/stats-parser
 */

import log from 'loglevel';
import { config } from '../../config/config.mjs';

/**
 * Validates raw stats data structure
 * @param {unknown} stats - Raw stats data to validate
 * @returns {stats is import('../../types/docker.mjs').DockerStats} Whether the stats are valid
 */
export function validateStats(stats) {
  if (!stats || typeof stats !== 'object') {
    return false;
  }

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

  if (errors.length > 0) {
    log.debug(`Stats validation failed: ${errors.join(', ')}`);
    return false;
  }

  return true;
}

/**
 * Parses Docker stats into a standardized format
 * @param {import('../../types/docker.mjs').DockerStats} stats - Raw Docker stats
 * @returns {import('../../types/docker.mjs').ParsedStats} Parsed stats
 */
export function parseStats(stats) {
  const { cpu_stats, precpu_stats, memory_stats, networks, read } = stats;

  // CPU usage calculation
  const cpuDelta = cpu_stats.cpu_usage.total_usage - (precpu_stats.cpu_usage.total_usage || 0);
  const sysDelta = cpu_stats.system_cpu_usage - (precpu_stats.system_cpu_usage || 0);
  let cpuPercent = 0;

  // Only calculate CPU percent if we have valid deltas
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
 * Manages a buffer of incoming stats data
 * @param {string} currentBuffer - Current buffer content
 * @param {Buffer} chunk - New data chunk
 * @returns {{ lines: string[], remainingBuffer: string }} Parsed lines and remaining buffer
 */
export function processBuffer(currentBuffer, chunk) {
  const buffer = currentBuffer + chunk.toString();
  const lines = [];
  let remainingBuffer = buffer;

  // Process complete lines
  while (remainingBuffer.length > 0) {
    const boundary = remainingBuffer.indexOf('\n');
    if (boundary === -1) {
      // No complete line yet, check size limit
      if (remainingBuffer.length > config.docker.stats.maxLineSize) {
        log.warn(`Line size limit exceeded (size=${remainingBuffer.length}), discarding`);
        remainingBuffer = '';
      }
      break;
    }

    const line = remainingBuffer.slice(0, boundary).trim();
    remainingBuffer = remainingBuffer.slice(boundary + 1);

    if (line) {
      lines.push(line);
    }
  }

  // Handle buffer overflow
  if (remainingBuffer.length > config.docker.stats.maxBufferSize) {
    log.warn(`Buffer overflow (size=${remainingBuffer.length}), resetting`);
    remainingBuffer = '';
  }

  return { lines, remainingBuffer };
}

/**
 * Parses a single line of stats data
 * @param {string} line - Raw JSON line to parse
 * @returns {import('../../types/docker.mjs').ParsedStats | null} Parsed stats or null if invalid
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
