/**
 * Docker Stats Validation
 * Shared validation functions for Docker stats data
 * @module services/docker/validation
 */
/**
 * @typedef {import('@types/docker.mjs').ParsedStats} ParsedStats
 */

import log from 'loglevel';
import { config } from '../../config/config.mjs';

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
 * Extracts CPU fields from stats
 * @param {import('dockerode').ContainerStats} stats - Raw Docker stats
 * @returns {Record<string, number>} CPU fields
 */
function extractCpuFields(stats) {
  const fields = {};

  fields.cpu_percent = calculateCpuPercent(stats);
  fields.cpu_total_usage = stats.cpu_stats.cpu_usage.total_usage;
  fields.cpu_system_usage = stats.cpu_stats.system_cpu_usage;
  fields.cpu_online = stats.cpu_stats.online_cpus || 1;
  fields.cpu_usage_in_kernelmode = stats.cpu_stats.cpu_usage.usage_in_kernelmode;
  fields.cpu_usage_in_usermode = stats.cpu_stats.cpu_usage.usage_in_usermode;

  // CPU Throttling fields
  if (stats.cpu_stats.throttling_data) {
    fields.cpu_throttling_periods = stats.cpu_stats.throttling_data.periods;
    fields.cpu_throttled_periods = stats.cpu_stats.throttling_data.throttled_periods;
    fields.cpu_throttled_time = stats.cpu_stats.throttling_data.throttled_time;
  }

  // Per-CPU usage
  if (stats.cpu_stats.cpu_usage.percpu_usage) {
    stats.cpu_stats.cpu_usage.percpu_usage.forEach((usage, index) => {
      fields[`cpu_${index}_usage`] = usage;
    });
  }

  return fields;
}

/**
 * Extracts memory fields from stats
 * @param {import('dockerode').ContainerStats} stats - Raw Docker stats
 * @returns {Record<string, number>} Memory fields
 */
function extractMemoryFields(stats) {
  const fields = {};

  // Basic memory stats
  fields.mem_used = stats.memory_stats.usage || 0;
  fields.mem_total = stats.memory_stats.limit || 0;
  if (typeof stats.memory_stats.max_usage === 'number') {
    fields.mem_max = stats.memory_stats.max_usage;
  }
  if (typeof stats.memory_stats.failcnt === 'number') {
    fields.mem_failcnt = stats.memory_stats.failcnt;
  }

  // Detailed Linux memory stats
  if (stats.memory_stats.stats) {
    const memStats = stats.memory_stats.stats;
    const memFields = {
      // RSS related
      mem_rss: memStats.rss,
      mem_rss_huge: memStats.rss_huge,
      mem_total_rss: memStats.total_rss,
      mem_total_rss_huge: memStats.total_rss_huge,

      // Cache related
      mem_cache: memStats.cache,
      mem_total_cache: memStats.total_cache,

      // Active/Inactive memory
      mem_active_anon: memStats.active_anon,
      mem_inactive_anon: memStats.inactive_anon,
      mem_active_file: memStats.active_file,
      mem_inactive_file: memStats.inactive_file,
      mem_total_active_anon: memStats.total_active_anon,
      mem_total_inactive_anon: memStats.total_inactive_anon,
      mem_total_active_file: memStats.total_active_file,
      mem_total_inactive_file: memStats.total_inactive_file,

      // Page faults
      mem_pgfault: memStats.pgfault,
      mem_pgmajfault: memStats.pgmajfault,
      mem_total_pgfault: memStats.total_pgfault,
      mem_total_pgmajfault: memStats.total_pgmajfault,

      // Page operations
      mem_pgpgin: memStats.pgpgin,
      mem_pgpgout: memStats.pgpgout,
      mem_total_pgpgin: memStats.total_pgpgin,
      mem_total_pgpgout: memStats.total_pgpgout,

      // File mappings
      mem_mapped_file: memStats.mapped_file,
      mem_total_mapped_file: memStats.total_mapped_file,

      // Unevictable memory
      mem_unevictable: memStats.unevictable,
      mem_total_unevictable: memStats.total_unevictable,

      // Writeback
      mem_writeback: memStats.writeback,
      mem_total_writeback: memStats.total_writeback,

      // Hierarchical limit
      mem_hierarchical_limit: memStats.hierarchical_memory_limit
    };

    // Windows-specific memory stats
    if (typeof stats.memory_stats.commitbytes === 'number') {
      memFields.mem_commit_bytes = stats.memory_stats.commitbytes;
    }
    if (typeof stats.memory_stats.commitpeakbytes === 'number') {
      memFields.mem_commit_peak_bytes = stats.memory_stats.commitpeakbytes;
    }
    if (typeof stats.memory_stats.privateworkingset === 'number') {
      memFields.mem_private_working_set = stats.memory_stats.privateworkingset;
    }

    // Add only defined fields
    Object.entries(memFields).forEach(([key, value]) => {
      if (value !== undefined) {
        fields[key] = value;
      }
    });
  }

  return fields;
}

/**
 * Extracts network fields from stats
 * @param {import('dockerode').ContainerStats} stats - Raw Docker stats
 * @returns {Record<string, number>} Network fields
 */
function extractNetworkFields(stats) {
  const fields = {};
  const { netIn, netOut } = calculateNetworkUsage(stats);

  fields.net_in_bytes = netIn;
  fields.net_out_bytes = netOut;

  if (stats.networks) {
    Object.entries(stats.networks).forEach(([iface, stats]) => {
      const netFields = {
        [`net_${iface}_in_bytes`]: stats.rx_bytes || 0,
        [`net_${iface}_out_bytes`]: stats.tx_bytes || 0,
        [`net_${iface}_in_packets`]: stats.rx_packets || 0,
        [`net_${iface}_out_packets`]: stats.tx_packets || 0,
        [`net_${iface}_in_errors`]: stats.rx_errors,
        [`net_${iface}_out_errors`]: stats.tx_errors,
        [`net_${iface}_in_dropped`]: stats.rx_dropped,
        [`net_${iface}_out_dropped`]: stats.tx_dropped
      };

      Object.entries(netFields).forEach(([key, value]) => {
        if (value !== undefined) {
          fields[key] = value;
        }
      });
    });
  }

  return fields;
}

/**
 * Extracts block I/O fields from stats
 * @param {import('dockerode').ContainerStats} stats - Raw Docker stats
 * @returns {Record<string, number>} Block I/O fields
 */
function extractBlockIOFields(stats) {
  const fields = {};

  if (stats.blkio_stats?.io_service_bytes_recursive) {
    const ioStats = {};
    stats.blkio_stats.io_service_bytes_recursive.forEach(stat => {
      if (stat.op && typeof stat.value === 'number') {
        ioStats[stat.op.toLowerCase()] = (ioStats[stat.op.toLowerCase()] || 0) + stat.value;
      }
    });

    const blkioFields = {
      blkio_read_bytes: ioStats.read,
      blkio_write_bytes: ioStats.write,
      blkio_sync_bytes: ioStats.sync,
      blkio_async_bytes: ioStats.async,
      blkio_total_bytes: ioStats.total
    };

    Object.entries(blkioFields).forEach(([key, value]) => {
      if (value !== undefined) {
        fields[key] = value;
      }
    });
  }

  return fields;
}

/**
 * Extracts PID stats from stats
 * @param {import('dockerode').ContainerStats} stats - Raw Docker stats
 * @returns {Record<string, number>} PID stats fields
 */
function extractPidStats(stats) {
  const fields = {};

  if (stats.pids_stats) {
    fields.pids_current = stats.pids_stats.current;
    if (stats.pids_stats.limit < Number.MAX_SAFE_INTEGER) {
      fields.pids_limit = stats.pids_stats.limit;
    }
  }

  return fields;
}

/**
 * Extracts timestamp fields from stats
 * @param {import('dockerode').ContainerStats} stats - Raw Docker stats
 * @returns {Record<string, number>} Timestamp fields (as unix timestamps)
 */
function extractTimestampFields(stats) {
  const fields = {};

  if (stats.read) {
    const readTime = new Date(stats.read).getTime();
    if (!Number.isNaN(readTime)) {
      fields.read_time = readTime;
    }
  }

  if (stats.preread) {
    const prereadTime = new Date(stats.preread).getTime();
    if (!Number.isNaN(prereadTime)) {
      fields.preread_time = prereadTime;
    }
  }

  return fields;
}

/**
 * Extracts process stats from stats
 * @param {import('dockerode').ContainerStats} stats - Raw Docker stats
 * @returns {Record<string, number>} Process stats fields
 */
function extractProcessStats(stats) {
  const fields = {};

  if (typeof stats.num_procs === 'number') {
    fields.num_procs = stats.num_procs;
  }

  return fields;
}

/**
 * Extracts storage stats from stats
 * @param {import('dockerode').ContainerStats} stats - Raw Docker stats
 * @returns {Record<string, number>} Storage stats fields
 */
function extractStorageStats(stats) {
  const fields = {};

  if (stats.storage_stats) {
    // Add any available storage stats fields
    // Currently Docker API doesn't expose much here, but we're ready for future additions
    Object.entries(stats.storage_stats).forEach(([key, value]) => {
      if (typeof value === 'number') {
        fields[`storage_${key}`] = value;
      }
    });
  }

  return fields;
}

/**
 * Extracts all available fields from Docker stats
 * @param {import('dockerode').ContainerStats} stats - Raw Docker stats
 * @returns {Record<string, number>} All available numeric fields
 */
function extractAllFields(stats) {
  const allFields = {
    ...extractTimestampFields(stats),
    ...extractProcessStats(stats),
    ...extractStorageStats(stats),
    ...extractCpuFields(stats),
    ...extractMemoryFields(stats),
    ...extractNetworkFields(stats),
    ...extractBlockIOFields(stats),
    ...extractPidStats(stats)
  };

  // Remove any undefined or null values
  Object.entries(allFields).forEach(([key, value]) => {
    if (value === undefined || value === null || !Number.isFinite(value)) {
      delete allFields[key];
      log.debug(`Removed invalid field ${key} with value ${value}`);
    }
  });

  return allFields;
}

/**
 * Filters fields based on configuration
 * @param {Record<string, number>} fields - All available fields
 * @param {string[]} configFields - Fields specified in configuration
 * @returns {Record<string, number>} Filtered fields
 */
function filterFields(fields, configFields) {
  if (!configFields.length) {
    return fields; // Return all fields if none specified
  }

  const filteredFields = {};
  const missingFields = new Set(configFields);
  const availableFields = new Set(Object.keys(fields));

  // For better performance with large field sets
  configFields.forEach(field => {
    if (availableFields.has(field)) {
      filteredFields[field] = fields[field];
      missingFields.delete(field);
    }
  });

  // Log any requested fields that weren't found (in a controlled way)
  if (missingFields.size > 0) {
    const missingList = Array.from(missingFields);
    if (missingList.length > 10) {
      log.debug(
        `${missingList.length} requested fields not found. First 10: ${missingList.slice(0, 10).join(', ')}...`
      );
    } else {
      log.debug(`Requested fields not found: ${missingList.join(', ')}`);
    }
  }

  return filteredFields;
}

/**
 * Parses Docker stats into a standardized format
 * @param {import('dockerode').ContainerStats} stats - Raw Docker stats
 * @returns {ParsedStats} Parsed stats
 */
export function parseStats(stats) {
  const timestamp = getValidTimestamp(stats);
  const allFields = extractAllFields(stats);
  const fields = filterFields(allFields, config.docker.stats.fields);

  return {
    ...fields,
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
