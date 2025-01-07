/**
 * Docker Type Definitions
 * Contains type definitions for Docker stats, events, and container information
 * @module types/docker
 */

/**
 * Raw Docker stats from container stats stream
 * @typedef {object} DockerStats
 * @property {object} cpu_stats - CPU statistics
 * @property {object} cpu_stats.cpu_usage - CPU usage information
 * @property {number} cpu_stats.cpu_usage.total_usage - Total CPU time consumed
 * @property {number} cpu_stats.system_cpu_usage - Total system CPU time
 * @property {number} [cpu_stats.online_cpus] - Number of CPUs available
 * @property {object} precpu_stats - Previous CPU statistics
 * @property {object} precpu_stats.cpu_usage - Previous CPU usage information
 * @property {number} precpu_stats.cpu_usage.total_usage - Previous total CPU time
 * @property {number} precpu_stats.system_cpu_usage - Previous system CPU time
 * @property {object} memory_stats - Memory statistics
 * @property {number} memory_stats.usage - Current memory usage in bytes
 * @property {number} memory_stats.limit - Memory limit in bytes
 * @property {object} [networks] - Network statistics per interface
 * @property {string} read - Timestamp of the stats
 * @example
 * const dockerStats = {
 *   cpu_stats: {
 *     cpu_usage: {
 *       total_usage: 1234567890,
 *     },
 *     system_cpu_usage: 9876543210,
 *     online_cpus: 8
 *   },
 *   precpu_stats: {
 *     cpu_usage: {
 *       total_usage: 1234567000,
 *     },
 *     system_cpu_usage: 9876543000
 *   },
 *   memory_stats: {
 *     usage: 1073741824,  // 1GB
 *     limit: 2147483648   // 2GB
 *   },
 *   networks: {
 *     eth0: {
 *       rx_bytes: 1024,
 *       tx_bytes: 2048
 *     }
 *   },
 *   read: '2023-01-01T00:00:00Z'
 * };
 */

/**
 * Docker event from events stream
 * @typedef {object} DockerEvent
 * @property {string} status - Event status (e.g., 'start', 'stop', 'die', 'kill')
 * @property {string} id - Container ID
 * @property {string} Type - Event type (e.g., 'container')
 * @property {string} Action - Event action
 * @property {object} Actor - Event actor details
 * @property {string} Actor.ID - Actor ID
 * @property {object} Actor.Attributes - Actor attributes
 * @property {string} time - Event timestamp
 * @property {string} timeNano - Event timestamp in nanoseconds
 * @example
 * const dockerEvent = {
 *   status: 'start',
 *   id: 'abc123...',
 *   Type: 'container',
 *   Action: 'start',
 *   Actor: {
 *     ID: 'abc123...',
 *     Attributes: {
 *       name: 'my-container',
 *       image: 'nginx:latest'
 *     }
 *   },
 *   time: '1630000000',
 *   timeNano: '1630000000000000000'
 * };
 */

/**
 * Container information from Docker API
 * @typedef {object} ContainerInfo
 * @property {string} Id - Container ID
 * @property {string[]} Names - Container names
 * @property {string} Image - Container image
 * @property {string} ImageID - Container image ID
 * @property {string} Command - Container command
 * @property {number} Created - Container creation timestamp
 * @property {string} State - Container state
 * @property {string} Status - Container status
 * @example
 * const containerInfo = {
 *   Id: 'abc123...',
 *   Names: ['/my-container'],
 *   Image: 'nginx:latest',
 *   ImageID: 'sha256:123...',
 *   Command: 'nginx -g daemon off;',
 *   Created: 1630000000,
 *   State: 'running',
 *   Status: 'Up 2 hours'
 * };
 */

/**
 * Parsed and normalized container stats
 * @typedef {object} ParsedStats
 * @property {number} cpuPercent - CPU usage percentage (0-100)
 * @property {number} memUsed - Memory usage in bytes
 * @property {number} memTotal - Total memory limit in bytes
 * @property {number} netIn - Network bytes received
 * @property {number} netOut - Network bytes transmitted
 * @property {Date} timestamp - Stats timestamp
 * @example
 * const parsedStats = {
 *   cpuPercent: 25.5,
 *   memUsed: 1073741824,    // 1GB
 *   memTotal: 2147483648,   // 2GB
 *   netIn: 1048576,         // 1MB
 *   netOut: 2097152,        // 2MB
 *   timestamp: new Date()
 * };
 */

/**
 * Stats stream context for managing stream state
 * @typedef {object} StatsStreamContext
 * @property {string} containerId - Container ID
 * @property {string} containerName - Container name
 * @property {string} rawData - Current buffer content
 * @property {number} lastValidParse - Timestamp of last valid parse
 * @example
 * const streamContext = {
 *   containerId: 'abc123...',
 *   containerName: 'my-container',
 *   rawData: '{"cpu_stats":...}',
 *   lastValidParse: Date.now()
 * };
 */

/**
 * Stream state for managing stream lifecycle
 * @typedef {'starting' | 'active' | 'stopping' | 'stopped'} StreamState
 */

/**
 * Stream information for managing stream state and data
 * @typedef {object} StreamInfo
 * @property {import('stream').Readable} stream - The stats stream
 * @property {string} buffer - Current buffer content
 * @property {number} consecutiveErrors - Count of consecutive errors
 * @property {StreamState} state - Current stream state
 */

export const DockerTypes = {
  /** @type {DockerStats} */
  DockerStats: null,
  /** @type {DockerEvent} */
  DockerEvent: null,
  /** @type {ContainerInfo} */
  ContainerInfo: null,
  /** @type {ParsedStats} */
  ParsedStats: null,
  /** @type {StatsStreamContext} */
  StatsStreamContext: null,
  /** @type {StreamInfo} */
  StreamInfo: null
};
