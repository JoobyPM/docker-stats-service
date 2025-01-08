/**
 * Metrics Transformer
 * Pure functions for transforming Docker stats into InfluxDB data points
 * @module services/metrics/transformer
 */

/**
 * @typedef {import('@types/docker.mjs').ParsedStats} ParsedStats
 */

/**
 * Validates the measurement field of a point
 * @param {unknown} measurement - Measurement to validate
 * @returns {boolean} Whether the measurement is valid
 */
function isValidMeasurement(measurement) {
  return Boolean(measurement && typeof measurement === 'string');
}

/**
 * Validates the tags field of a point
 * @param {unknown} tags - Tags to validate
 * @returns {boolean} Whether the tags are valid
 */
function isValidTags(tags) {
  return Boolean(tags && typeof tags === 'object');
}

/**
 * Validates the fields of a point
 * @param {unknown} fields - Fields to validate
 * @returns {boolean} Whether the fields are valid
 */
function isValidFields(fields) {
  return Boolean(fields && typeof fields === 'object' && Object.keys(fields).length > 0);
}

/**
 * Validates the timestamp of a point
 * @param {unknown} timestamp - Timestamp to validate
 * @returns {boolean} Whether the timestamp is valid
 */
function isValidTimestamp(timestamp) {
  return timestamp instanceof Date;
}

/**
 * Validates a single point
 * @param {unknown} point - Point to validate
 * @returns {boolean} Whether the point is valid
 */
function isValidPoint(point) {
  if (!point) {
    return false;
  }

  const validations = [
    isValidMeasurement(point.measurement),
    isValidTags(point.tags),
    isValidFields(point.fields),
    isValidTimestamp(point.timestamp)
  ];

  return validations.every(Boolean);
}

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
  // Extract timestamp and remove it from fields
  const { timestamp, ...fields } = stats;

  return [
    {
      measurement: 'docker_stats',
      tags: {
        container_id: containerId,
        container_name: containerName
      },
      fields,
      timestamp
    }
  ];
}

/**
 * Validates InfluxDB points
 * @param {Array<{
 *   measurement: string,
 *   tags: { [key: string]: string },
 *   fields: { [key: string]: number },
 *   timestamp: Date
 * }>} points - InfluxDB points to validate
 * @returns {boolean} Whether the points are valid
 */
export function validatePoints(points) {
  return Array.isArray(points) && points.length > 0 && points.every(isValidPoint);
}
