/**
 * Parsed and normalized container stats
 * @typedef {object} ParsedStats
 * @property {number} cpuPercent - CPU usage percentage (0-100)
 * @property {number} memUsed - Memory usage in bytes
 * @property {number} memTotal - Total memory limit in bytes
 * @property {number} netIn - Network bytes received
 * @property {number} netOut - Network bytes transmitted
 * @property {Date} timestamp - Stats timestamp
 */

/**
 * Stream information for managing stream state and data
 * @typedef {object} StreamInfo
 * @property {import('stream').Readable} stream - The stats stream
 * @property {string} buffer - Current buffer content
 * @property {number} consecutiveErrors - Count of consecutive errors
 * @property {StreamState} state - Current stream state
 */

/**
 * Stream state for managing stream lifecycle
 * @typedef {'starting' | 'active' | 'stopping' | 'stopped' | 'unknown'} StreamState
 */
