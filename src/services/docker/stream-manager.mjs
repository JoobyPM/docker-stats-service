/**
 * Docker Stream Manager
 * Handles stream lifecycle and state transitions for container stats streams
 * @module services/docker/stream-manager
 */

import log from 'loglevel';
import { processBuffer, parseLine } from './stats-parser.mjs';
import { DockerTypes } from '../../types/docker.mjs';

/**
 * Creates a stream manager for handling container stats streams
 * @param {object} params - Parameters
 * @param {function(string, string, DockerTypes.ParsedStats): Promise<void>} params.onStats - Stats callback
 * @param {function(string): void} params.onStreamEnd - Called when a stream ends
 * @returns {object} Stream manager functions
 */
export function createStreamManager({ onStats, onStreamEnd }) {
  /** @type {Map<string, DockerTypes.StreamInfo>} */
  const streams = new Map();
  const MAX_CONSECUTIVE_ERRORS = 3;

  /**
   * Gets the current state of a stream
   * @param {string} containerId - Container ID
   * @returns {DockerTypes.StreamState | 'unknown'} Stream state
   */
  function getStreamState(containerId) {
    return streams.get(containerId)?.state || 'unknown';
  }

  /**
   * Checks if a stream exists and is in a specific state
   * @param {string} containerId - Container ID
   * @param {DockerTypes.StreamState} state - Expected state
   * @returns {boolean} Whether the stream exists and is in the expected state
   */
  function isStreamInState(containerId, state) {
    return getStreamState(containerId) === state;
  }

  /**
   * Safely transitions a stream to a new state
   * @param {string} containerId - Container ID
   * @param {DockerTypes.StreamState} newState - New state
   * @returns {boolean} Whether the transition was successful
   */
  function transitionStreamState(containerId, newState) {
    const streamInfo = streams.get(containerId);
    if (!streamInfo) return false;

    // Validate state transitions
    const validTransitions = {
      starting: ['active', 'stopped'],
      active: ['stopping', 'stopped'],
      stopping: ['stopped'],
      stopped: []
    };

    if (!validTransitions[streamInfo.state]?.includes(newState)) {
      log.warn(
        `Invalid state transition for container=${containerId}: ${streamInfo.state} -> ${newState}`
      );
      return false;
    }

    streamInfo.state = newState;
    return true;
  }

  /**
   * Adds a new stats stream
   * @param {string} containerId - Container ID
   * @param {string} containerName - Container name
   * @param {import('stream').Readable} stream - Stats stream
   * @returns {boolean} Whether the stream was added successfully
   */
  function addStream(containerId, containerName, stream) {
    // Don't add if a stream already exists in any state except 'stopped'
    if (streams.has(containerId) && !isStreamInState(containerId, 'stopped')) {
      log.warn(`Stream already exists for container=${containerId}, skipping`);
      return false;
    }

    streams.set(containerId, {
      stream,
      buffer: '',
      consecutiveErrors: 0,
      state: 'starting'
    });

    // Set up stream event handlers
    stream.on('data', chunk => {
      const streamInfo = streams.get(containerId);
      if (!streamInfo || streamInfo.state !== 'active') return;

      const { lines, remainingBuffer } = processBuffer(streamInfo.buffer, chunk);
      streamInfo.buffer = remainingBuffer;

      for (const line of lines) {
        const parsedStats = parseLine(line);
        if (parsedStats) {
          onStats(containerId, containerName, parsedStats)
            .then(() => {
              streamInfo.consecutiveErrors = 0;
            })
            .catch(err => {
              log.error(`Error handling stats for container=${containerId}:`, err);
              streamInfo.consecutiveErrors++;
            });
        } else {
          streamInfo.consecutiveErrors++;
        }

        // Check for too many errors
        if (streamInfo.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          log.error(
            `Too many consecutive errors for container=${containerId}, marking stream for removal`
          );
          removeStream(containerId);
          return;
        }
      }
    });

    stream.on('end', () => {
      log.info(`Stream ended for container=${containerId}`);
      removeStream(containerId);
    });

    stream.on('error', err => {
      log.error(`Stream error for container=${containerId}:`, err);
      removeStream(containerId);
    });

    // Mark stream as active
    transitionStreamState(containerId, 'active');
    return true;
  }

  /**
   * Removes a stats stream
   * @param {string} containerId - Container ID
   * @returns {boolean} Whether the stream was removed successfully
   */
  function removeStream(containerId) {
    const streamInfo = streams.get(containerId);
    if (!streamInfo) return false;

    // Only allow removal if not already stopping/stopped
    if (['stopping', 'stopped'].includes(streamInfo.state)) {
      return false;
    }

    try {
      // Mark as stopping to prevent concurrent removal
      transitionStreamState(containerId, 'stopping');

      // Clean up the stream
      streamInfo.stream.destroy();
      transitionStreamState(containerId, 'stopped');
      streams.delete(containerId);

      // Notify parent
      onStreamEnd(containerId);
      return true;
    } catch (err) {
      log.error(`Error removing stream for container=${containerId}:`, err);
      return false;
    }
  }

  /**
   * Removes all streams
   * @returns {Promise<void>}
   */
  async function removeAllStreams() {
    const containerIds = Array.from(streams.keys());
    for (const containerId of containerIds) {
      removeStream(containerId);
    }
    streams.clear();
  }

  return {
    addStream,
    removeStream,
    removeAllStreams,
    getStreamState,
    isStreamInState
  };
}
