/**
 * Container Watcher Service
 * Manages container stats streams and orchestrates monitoring
 * @module services/docker/containers
 */

import log from 'loglevel';
import Docker from 'dockerode';
import { config } from '../../config/config.mjs';
import { createStreamManager } from './stream-manager.mjs';
import { DockerTypes } from '../../types/docker.mjs';

/**
 * Creates a container watcher instance
 * @param {function(string, string, DockerTypes.ParsedStats): Promise<void>} onStats - Stats callback
 * @returns {object} Container watcher functions and state management
 */
export function createContainerWatcher(onStats) {
  const docker = new Docker({ socketPath: config.docker.socketPath });
  let isShuttingDown = false;

  // Create stream manager
  const streamManager = createStreamManager({
    onStats,
    onStreamEnd: containerId => {
      log.debug(`Stream ended for container=${containerId}, checking container status`);
      checkContainerStatus(containerId);
    }
  });

  /**
   * Checks if a container still exists and is running
   * If it is, restarts the stats stream
   * @param {string} containerId - Container ID
   */
  async function checkContainerStatus(containerId) {
    if (isShuttingDown) return;

    try {
      const container = docker.getContainer(containerId);
      const info = await container.inspect();

      // Only restart if container is still running
      if (info.State?.Running) {
        log.info(`Container ${containerId} still running, restarting stats stream`);
        const containerName = info.Name.replace(/^\//, '');
        await watchContainer(containerId, containerName);
      } else {
        log.info(`Container ${containerId} no longer running, not restarting stream`);
      }
    } catch (err) {
      if (err.statusCode === 404) {
        log.info(`Container ${containerId} no longer exists`);
      } else {
        log.error(`Error checking container ${containerId} status:`, err);
      }
    }
  }

  /**
   * Stops watching a container's stats
   * @param {string} containerId - Container ID
   */
  function unwatchContainer(containerId) {
    streamManager.removeStream(containerId);
  }

  /**
   * Starts watching a container's stats
   * @param {string} containerId - Container ID
   * @param {string} containerName - Container name
   * @returns {Promise<void>}
   */
  async function watchContainer(containerId, containerName) {
    if (isShuttingDown) {
      log.info(`Skipping container watch during shutdown: ${containerId}`);
      return;
    }

    try {
      const container = docker.getContainer(containerId);
      const statsStream = await container.stats({ stream: true });

      if (!streamManager.addStream(containerId, containerName, statsStream)) {
        // If stream wasn't added (e.g., already exists), clean up the new stream
        statsStream.destroy();
      }

      log.debug(`Started watching container=${containerId} name=${containerName}`);
    } catch (err) {
      log.error(`Error setting up stats stream for container=${containerId}:`, err);
    }
  }

  /**
   * Starts watching all currently running containers
   * @returns {Promise<void>}
   */
  async function watchRunningContainers() {
    /** @type {DockerTypes.ContainerInfo[]} */
    const containers = await docker.listContainers();
    for (const info of containers) {
      if (!info.Id) {
        log.warn('Container info missing Id, skipping');
        continue;
      }
      const containerName = info.Names[0]?.replace('/', '') || 'unknown_container';
      await watchContainer(info.Id, containerName);
    }
  }

  /**
   * Stops watching all containers
   * @returns {Promise<void>}
   */
  async function shutdown() {
    isShuttingDown = true;
    await streamManager.removeAllStreams();
  }

  return {
    watchContainer,
    unwatchContainer,
    watchRunningContainers,
    shutdown
  };
}
