/**
 * Metrics Transformer
 * Pure functions for transforming Docker stats into InfluxDB data points
 * @module services/metrics/transformer
 */

/**
 * @typedef {import('@types/docker.mjs').ParsedStats} ParsedStats
 */

import log from 'loglevel';

/**
 * Transforms parsed Docker stats into InfluxDB data points
 * @param {string} containerId - Container ID
 * @param {string} containerName - Container name
 * @param {ParsedStats} stats - Parsed Docker stats
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
 * Validates that a value is a non-null object
 * @param {unknown} value - Value to validate
 * @returns {boolean} Whether the value is a non-null object
 */
function isNonNullObject(value) {
  return typeof value === 'object' && value !== null;
}

/**
 * Validates the basic structure of a data point
 * @param {unknown} point - Point to validate
 * @returns {boolean} Whether the point has a valid basic structure
 */
function hasValidPointStructure(point) {
  // First ensure point is a valid object
  if (!isNonNullObject(point)) {
    log.debug('Invalid point: not a non-null object');
    return false;
  }

  // Check each required property
  const validations = [
    {
      check: () => typeof point.measurement === 'string',
      field: 'measurement',
      expected: 'string'
    },
    { check: () => isNonNullObject(point.tags), field: 'tags', expected: 'non-null object' },
    { check: () => isNonNullObject(point.fields), field: 'fields', expected: 'non-null object' },
    { check: () => point.timestamp instanceof Date, field: 'timestamp', expected: 'Date' }
  ];

  for (const { check, field, expected } of validations) {
    if (!check()) {
      log.debug(`Invalid point: ${field} is not a ${expected}`);
      return false;
    }
  }

  return true;
}

/**
 * Validates that all required fields are present and are numbers
 * @param {object} fields - Fields to validate
 * @param {string[]} requiredFields - List of required field names
 * @returns {boolean} Whether all required fields are valid numbers
 */
function hasValidFields(fields, requiredFields) {
  for (const field of requiredFields) {
    if (typeof fields[field] !== 'number') {
      log.debug(`Invalid fields: ${field} is not a number`);
      return false;
    }
  }
  return true;
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
  if (!Array.isArray(points)) {
    log.debug('Invalid points: not an array');
    return false;
  }

  if (points.length === 0) {
    log.debug('Invalid points: empty array');
    return false;
  }

  const requiredFields = ['cpu_percent', 'mem_used', 'mem_total', 'net_in_bytes', 'net_out_bytes'];

  return points.every((point, index) => {
    if (!hasValidPointStructure(point)) {
      log.debug(`Invalid point at index ${index}`);
      return false;
    }

    if (!hasValidFields(point.fields, requiredFields)) {
      log.debug(`Invalid fields at index ${index}`);
      return false;
    }

    return true;
  });
}
