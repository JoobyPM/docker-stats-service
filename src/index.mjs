/**
 * Docker Stats Service - Main Application
 *
 * This service collects real-time Docker container metrics and stores them in InfluxDB.
 * It automatically discovers containers, tracks their resource usage, and provides
 * detailed metrics that can be visualized through Grafana.
 *
 * Features:
 * - Automatic container discovery
 * - Real-time metrics collection
 * - Efficient metrics batching
 * - Graceful shutdown handling
 * - Retry mechanisms for resilience
 * @module docker-stats-service
 */

import log from 'loglevel';
import { config } from './config/config.mjs';
import { createDockerEventsManager } from './services/docker/events.mjs';
import { createContainerWatcher } from './services/docker/containers.mjs';
import { createMetricsHandler } from './services/metrics/handler.mjs';
import { createGracefulShutdown } from './utils/shutdown.mjs';

// Initialize graceful shutdown handler
const shutdown = createGracefulShutdown({ timeout: config.shutdownTimeoutMs });

/**
 * Main application bootstrap
 * Initializes services, sets up monitoring, and starts the application
 * @async
 */
(async function main() {
  try {
    // Initialize shutdown handler
    shutdown.init();

    // Initialize metrics handler
    const metricsHandler = createMetricsHandler(config);
    await metricsHandler.initDatabase(config.influx.database);

    // Initialize container watcher
    const containerWatcher = createContainerWatcher(async (containerId, containerName, stats) => {
      await metricsHandler.handleStats(containerId, containerName, stats);
    });

    // Initialize events manager
    const eventsManager = createDockerEventsManager({
      onContainerStart: async (containerId, containerName) => {
        await containerWatcher.watchContainer(containerId, containerName);
      },
      onContainerStop: async containerId => {
        containerWatcher.unwatchContainer(containerId);
      }
    });

    // Validate Docker access
    await eventsManager.validateAccess();

    // Watch running containers
    await containerWatcher.watchRunningContainers();

    // Start monitoring Docker events
    await eventsManager.startMonitoring();

    // Register shutdown handlers
    shutdown.register('events-manager', async () => {
      await eventsManager.stopMonitoring();
    });

    shutdown.register('container-watcher', async () => {
      await containerWatcher.shutdown();
    });

    shutdown.register('metrics-handler', async () => {
      await metricsHandler.shutdown();
    });

    log.info('Docker stats service is running. Press Ctrl+C to stop.');
  } catch (err) {
    log.error('Fatal error initializing:', err);
    process.exit(1);
  }
})();
