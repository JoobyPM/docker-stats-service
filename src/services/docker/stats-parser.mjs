/**
 * Docker Stats Stream Parser
 * Pure functions for parsing and validating Docker stats data
 * @module services/docker/stats-parser
 */

import log from 'loglevel';
import { config } from '../../config/config.mjs';
import { parseLine } from './validation.mjs';

/**
 * Manages a buffer of incoming stats data
 * @param {string} currentBuffer - Current buffer content
 * @param {Buffer} chunk - New data chunk
 * @returns {{ lines: string[], remainingBuffer: string }} Parsed lines and remaining buffer
 */
export function processBuffer(currentBuffer, chunk) {
  const buffer = currentBuffer + chunk.toString();
  const lines = [];
  let remainingBuffer = buffer;

  // Process complete lines
  while (remainingBuffer.length > 0) {
    const boundary = remainingBuffer.indexOf('\n');
    if (boundary === -1) {
      // No complete line yet, check size limit
      if (remainingBuffer.length > config.docker.stats.maxLineSize) {
        log.warn(`Line size limit exceeded (size=${remainingBuffer.length}), discarding`);
        remainingBuffer = '';
      }
      break;
    }

    const line = remainingBuffer.slice(0, boundary).trim();
    remainingBuffer = remainingBuffer.slice(boundary + 1);

    if (line) {
      lines.push(line);
    }
  }

  // Handle buffer overflow
  if (remainingBuffer.length > config.docker.stats.maxBufferSize) {
    log.warn(`Buffer overflow (size=${remainingBuffer.length}), resetting`);
    remainingBuffer = '';
  }

  return { lines, remainingBuffer };
}

// Re-export parseLine from validation module for backward compatibility
export { parseLine };
