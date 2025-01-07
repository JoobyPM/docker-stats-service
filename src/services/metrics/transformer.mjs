/**
 * Metrics Transformer
 * Pure functions for transforming Docker stats into InfluxDB data points
 * @module services/metrics/transformer
 */

/**
 * Transforms parsed Docker stats into InfluxDB data points
 * @param {string} containerId - Container ID
 * @param {string} containerName - Container name
 * @param {import('../../types/docker.mjs').ParsedStats} stats - Parsed Docker stats
 * @returns {Array<{
 *   measurement: string,
 *   tags: { [key: string]: string },
 *   fields: { [key: string]: number },
 *   timestamp: Date
 * }>} InfluxDB data points
 */
export function transformStats(containerId, containerName, stats) {
  return [
    {
      measurement: 'docker_stats',
      tags: {
        container_id: containerId,
        container_name: containerName
      },
      fields: {
        cpu_percent: stats.cpuPercent,
        mem_used: stats.memUsed,
        mem_total: stats.memTotal,
        net_in_bytes: stats.netIn,
        net_out_bytes: stats.netOut
      },
      timestamp: stats.timestamp
    }
  ];
}

/**
 * Validates transformed data points
 * @param {Array<{
 *   measurement: string,
 *   tags: { [key: string]: string },
 *   fields: { [key: string]: number },
 *   timestamp: Date
 * }>} points - Data points to validate
 * @returns {boolean} Whether the points are valid
 */
export function validatePoints(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return false;
  }

  return points.every(point => {
    // Check required fields
    if (!point.measurement || typeof point.measurement !== 'string') {
      return false;
    }

    // Check tags
    if (!point.tags || typeof point.tags !== 'object') {
      return false;
    }

    // Check fields
    if (!point.fields || typeof point.fields !== 'object') {
      return false;
    }

    // Check timestamp
    if (!(point.timestamp instanceof Date)) {
      return false;
    }

    // Validate specific fields we expect
    const requiredFields = [
      'cpu_percent',
      'mem_used',
      'mem_total',
      'net_in_bytes',
      'net_out_bytes'
    ];
    return requiredFields.every(field => typeof point.fields[field] === 'number');
  });
}
