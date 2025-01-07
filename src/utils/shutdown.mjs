import log from 'loglevel';

/**
 * @typedef {object} ShutdownOptions
 * @property {number} [timeout=10000] - Maximum time in milliseconds to wait for shutdown handlers
 */

/**
 * @typedef {object} ShutdownManager
 * @property {function(string, function(): Promise<void>): void} register - Registers a shutdown handler
 * @property {function(): void} init - Initializes signal handlers
 * @property {boolean} isShuttingDown - Whether shutdown is in progress
 * @property {number} timeout - Maximum time to wait for shutdown handlers
 */

/**
 * Executes a single shutdown handler with timeout
 * @param {string} name - Handler name
 * @param {Function} handler - Handler function
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<void>}
 */
async function executeHandler(name, handler, timeout) {
  try {
    log.info(`Running shutdown handler: ${name}`);
    await Promise.race([
      handler(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Shutdown handler '${name}' timed out`)), timeout)
      )
    ]);
    log.info(`Shutdown handler completed: ${name}`);
  } catch (error) {
    log.error(`Error in shutdown handler '${name}':`, error);
  }
}

/**
 * Creates a graceful shutdown handler
 * @param {object} options - Shutdown options
 * @param {number} options.timeout - Shutdown timeout in milliseconds
 * @returns {object} Shutdown handler interface
 */
export function createGracefulShutdown({ timeout = 10_000 } = {}) {
  const state = {
    handlers: new Map(),
    isShuttingDown: false,
    timeout
  };

  /**
   * Registers a new shutdown handler
   * @param {string} name - Unique identifier for the handler
   * @param {Function} handler - Async function to execute during shutdown
   */
  function register(name, handler) {
    if (state.isShuttingDown) {
      log.warn(`Shutdown in progress, ignoring handler registration: ${name}`);
      return;
    }
    state.handlers.set(name, handler);
  }

  /**
   * Executes the shutdown sequence
   * @param {string} signal - The signal that triggered the shutdown
   * @returns {Promise<void>}
   */
  async function shutdown(signal) {
    if (state.isShuttingDown) {
      log.warn('Shutdown already in progress');
      return;
    }

    log.info(`Initiating graceful shutdown (signal: ${signal})`);
    state.isShuttingDown = true;

    try {
      // Create an array of promises for all handlers
      const shutdownPromises = Array.from(state.handlers.entries()).map(([name, handler]) =>
        executeHandler(name, handler, state.timeout)
      );

      // Wait for all handlers to complete
      await Promise.allSettled(shutdownPromises);
      log.info('Graceful shutdown completed');
    } catch (error) {
      log.error('Error during shutdown:', error);
    } finally {
      // Force exit after all handlers complete or timeout
      process.exit(0);
    }
  }

  /**
   * Initializes shutdown handlers for process signals
   * Sets up handlers for SIGTERM, SIGINT, uncaughtException, and unhandledRejection
   */
  function init() {
    // Handle process signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', error => {
      log.error('Uncaught exception:', error);
      shutdown('uncaughtException').then(null);
    });
    process.on('unhandledRejection', (reason, promise) => {
      log.error('Unhandled rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection').then(null);
    });
  }

  return {
    register,
    init,
    get isShuttingDown() {
      return state.isShuttingDown;
    },
    set timeout(value) {
      state.timeout = value;
    }
  };
}
