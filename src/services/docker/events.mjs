/**
 * Docker Events Manager
 * Handles Docker event monitoring and container lifecycle events
 * @module services/docker/events
 */

import log from 'loglevel';
import Docker from 'dockerode';
import { config } from '../../config/config.mjs';
import { DockerTypes } from '../../types/docker.mjs';

/**
 * Creates a Docker events manager
 * @param {object} callbacks - Event callbacks
 * @param {function(string, string): Promise<void>} callbacks.onContainerStart - Called when a container starts
 * @param {function(string): Promise<void>} callbacks.onContainerStop - Called when a container stops
 * @returns {object} Docker events manager functions
 */
export function createDockerEventsManager(callbacks) {
  const docker = new Docker({ socketPath: config.docker.socketPath });
  let eventsStream = null;

  /**
   * Validates Docker socket access and permissions
   * @returns {Promise<void>}
   * @throws {Error} If Docker socket is not accessible or has incorrect permissions
   */
  async function validateAccess() {
    try {
      // Try to list containers as a basic access test
      await docker.ping();
      log.info('Docker socket access verified');

      // Test event stream access
      const testStream = await docker.getEvents({
        filters: { type: ['container'] },
        since: 0,
        until: 1
      });

      await new Promise((resolve, reject) => {
        testStream.on('error', reject);
        testStream.on('end', resolve);
        // Ensure we don't hang
        setTimeout(() => {
          testStream?.destroy();
          resolve();
        }, 1000);
      });

      log.info('Docker event stream access verified');
    } catch (err) {
      if (err.code === 'EACCES') {
        throw new Error(
          'Permission denied accessing Docker socket. Please ensure:\n' +
            '1. The socket is mounted: -v /var/run/docker.sock:/var/run/docker.sock\n' +
            '2. The socket has correct permissions: sudo chmod 666 /var/run/docker.sock\n' +
            '3. The container user has necessary group membership'
        );
      } else if (err.code === 'ENOENT') {
        throw new Error(
          'Docker socket not found. Please ensure:\n' +
            '1. Docker is running on the host\n' +
            '2. The socket is mounted correctly in docker-compose.yml'
        );
      } else {
        throw new Error(`Docker access validation failed: ${err.message}`);
      }
    }
  }

  /**
   * Lists all running containers
   * @returns {Promise<Array<{id: string, name: string}>>} List of running containers
   */
  async function listContainers() {
    /** @type {DockerTypes.ContainerInfo[]} */
    const containers = await docker.listContainers();
    return containers.map(info => ({
      id: info.Id,
      name: info.Names[0]?.replace('/', '') || 'unknown_container'
    }));
  }

  /**
   * Gets container information by ID
   * @param {string} containerId - Container ID
   * @returns {Promise<{id: string, name: string}>} Container information
   * @throws {Error} If container not found or other error
   */
  async function getContainerInfo(containerId) {
    try {
      const container = docker.getContainer(containerId);
      /** @type {DockerTypes.ContainerInfo} */
      const info = await container.inspect();

      if (!info || !info.Name) {
        throw new Error('Invalid container info returned');
      }

      return {
        id: containerId,
        name: info.Name.replace(/^\//, '')
      };
    } catch (err) {
      if (err.statusCode === 404) {
        throw new Error(`Container ${containerId} no longer exists`);
      }
      throw err;
    }
  }

  /**
   * Starts monitoring Docker events
   * @returns {Promise<void>}
   */
  async function startMonitoring() {
    if (eventsStream) {
      log.warn('Events stream already exists, stopping existing stream first');
      await stopMonitoring();
    }

    eventsStream = await docker.getEvents({
      filters: JSON.stringify({
        type: ['container']
      })
    });

    eventsStream.on('data', async chunk => {
      try {
        /** @type {DockerTypes.DockerEvent} */
        const event = JSON.parse(chunk.toString());
        const { status, id } = event;
        if (!status || !id) return;

        switch (status) {
          case 'start':
            log.info(`Container started: ${id}`);
            try {
              const { name } = await getContainerInfo(id);
              await callbacks.onContainerStart(id, name);
            } catch (err) {
              log.error(`Error handling container start for ${id}:`, err);
            }
            break;

          case 'stop':
          case 'die':
          case 'kill':
            log.info(`Container stopping: ${id}, status=${status}`);
            await callbacks.onContainerStop(id);
            break;
        }
      } catch (parseErr) {
        log.error('Failed to parse Docker event:', parseErr);
      }
    });

    eventsStream.on('error', err => {
      log.error('Docker events stream error:', err);
    });

    eventsStream.on('end', () => {
      log.info('Docker events stream ended');
      eventsStream = null;
    });

    log.info('Docker events monitoring started');
  }

  /**
   * Stops monitoring Docker events
   * @returns {Promise<void>}
   */
  async function stopMonitoring() {
    if (eventsStream) {
      log.info('Stopping Docker events monitoring...');
      eventsStream.destroy();
      eventsStream = null;
    }
  }

  return {
    validateAccess,
    listContainers,
    getContainerInfo,
    startMonitoring,
    stopMonitoring
  };
}
