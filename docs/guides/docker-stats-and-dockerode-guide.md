# Docker Stats and Dockerode Guide

This guide explains how the Docker Stats Service interacts with Docker using the Dockerode library.

## Docker Stats API

### Overview

The Docker Stats API provides real-time container metrics through a streaming interface.

```js
// Example stats stream creation
const container = await docker.getContainer(containerId);
const stream = await container.stats({ stream: true });
```

### Stats Format

Raw stats from Docker come in JSON format:

```json
{
  "cpu_stats": {
    "cpu_usage": {
      "total_usage": 406981000,
      "percpu_usage": [123456, 234567],
      "usage_in_kernelmode": 51890000,
      "usage_in_usermode": 355091000
    },
    "system_cpu_usage": 2800680000000,
    "online_cpus": 16,
    "throttling_data": {
      "periods": 11,
      "throttled_periods": 8,
      "throttled_time": 584099000
    }
  },
  "memory_stats": {
    "usage": 80269312,
    "limit": 268435456,
    "stats": {
      "active_anon": 75771904,
      "inactive_anon": 0,
      "active_file": 0,
      "inactive_file": 0,
      "unevictable": 0,
      "pgfault": 12345,
      "pgmajfault": 0
    }
  },
  "networks": {
    "eth0": {
      "rx_bytes": 1574,
      "tx_bytes": 568,
      "rx_packets": 14,
      "tx_packets": 7,
      "rx_errors": 0,
      "tx_errors": 0,
      "rx_dropped": 0,
      "tx_dropped": 0
    }
  },
  "blkio_stats": {
    "io_service_bytes_recursive": [
      {
        "major": 8,
        "minor": 0,
        "op": "Read",
        "value": 4096
      },
      {
        "major": 8,
        "minor": 0,
        "op": "Write",
        "value": 8192
      }
    ]
  },
  "pids_stats": {
    "current": 22
  },
  "num_procs": 22,
  "read": "2024-02-20T12:34:56.789Z",
  "preread": "2024-02-20T12:34:55.789Z"
}
```

## Dockerode Integration

### Client Setup

```js
import Docker from 'dockerode';

const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock'
});
```

### Container Operations

1. **List Containers**

   ```js
   const containers = await docker.listContainers({
     all: false, // Only running containers
     filters: {
       status: ['running']
     }
   });
   ```

2. **Get Container**
   ```js
   const container = await docker.getContainer(containerId);
   const info = await container.inspect();
   ```

### Event Monitoring

```js
const events = await docker.getEvents({
  filters: {
    type: ['container'],
    event: ['start', 'stop', 'die']
  }
});

events.on('data', data => {
  const event = JSON.parse(data.toString());
  // Handle container event
});
```

## Stream Management

### Stream Creation

```js
async function createStatsStream(containerId) {
  const container = await docker.getContainer(containerId);
  return await container.stats({
    stream: true,
    one_shot: false
  });
}
```

### Stream Handling

```js
function handleStream(stream, containerId) {
  stream.on('data', chunk => {
    const stats = JSON.parse(chunk.toString());
    // Transform stats into InfluxDB points
    const points = [
      {
        measurement: 'docker_stats',
        tags: {
          container_id: containerId,
          container_name: stats.name
        },
        fields: {
          // CPU metrics
          cpu_percent: calculateCPUPercent(stats),
          cpu_total_usage: stats.cpu_stats.cpu_usage.total_usage,
          cpu_system_usage: stats.cpu_stats.system_cpu_usage,
          cpu_online: stats.cpu_stats.online_cpus,
          cpu_usage_in_kernelmode: stats.cpu_stats.cpu_usage.usage_in_kernelmode,
          cpu_usage_in_usermode: stats.cpu_stats.cpu_usage.usage_in_usermode,
          cpu_throttling_periods: stats.cpu_stats.throttling_data.periods,
          cpu_throttled_periods: stats.cpu_stats.throttling_data.throttled_periods,
          cpu_throttled_time: stats.cpu_stats.throttling_data.throttled_time,

          // Memory metrics
          mem_used: stats.memory_stats.usage,
          mem_total: stats.memory_stats.limit,
          mem_active_anon: stats.memory_stats.stats.active_anon,
          mem_inactive_anon: stats.memory_stats.stats.inactive_anon,
          mem_active_file: stats.memory_stats.stats.active_file,
          mem_inactive_file: stats.memory_stats.stats.inactive_file,
          mem_unevictable: stats.memory_stats.stats.unevictable,
          mem_pgfault: stats.memory_stats.stats.pgfault,
          mem_pgmajfault: stats.memory_stats.stats.pgmajfault,

          // Network metrics
          net_in_bytes: stats.networks?.eth0?.rx_bytes || 0,
          net_out_bytes: stats.networks?.eth0?.tx_bytes || 0,
          net_eth0_in_bytes: stats.networks?.eth0?.rx_bytes || 0,
          net_eth0_out_bytes: stats.networks?.eth0?.tx_bytes || 0,
          net_eth0_in_packets: stats.networks?.eth0?.rx_packets || 0,
          net_eth0_out_packets: stats.networks?.eth0?.tx_packets || 0,
          net_eth0_in_errors: stats.networks?.eth0?.rx_errors || 0,
          net_eth0_out_errors: stats.networks?.eth0?.tx_errors || 0,
          net_eth0_in_dropped: stats.networks?.eth0?.rx_dropped || 0,
          net_eth0_out_dropped: stats.networks?.eth0?.tx_dropped || 0,

          // Block I/O metrics
          blkio_read_bytes: getBlkioBytes(stats, 'Read'),
          blkio_write_bytes: getBlkioBytes(stats, 'Write'),

          // Process metrics
          pids_current: stats.pids_stats.current,
          num_procs: stats.num_procs,

          // Timestamp metrics
          read_time: new Date(stats.read).getTime(),
          preread_time: new Date(stats.preread).getTime()
        }
      }
    ];
    // Write points to InfluxDB
  });

  stream.on('error', error => {
    logger.error('Stream error', { containerId, error });
  });

  stream.on('end', () => {
    logger.info('Stream ended', { containerId });
  });
}
```

## Error Handling

### Common Errors

1. **Container Not Found**

   ```js
   try {
     const container = await docker.getContainer(containerId);
     await container.inspect();
   } catch (error) {
     if (error.statusCode === 404) {
       logger.error('Container not found', { containerId });
     }
   }
   ```

2. **Permission Denied**
   ```js
   try {
     await createStatsStream(containerId);
   } catch (error) {
     if (error.statusCode === 403) {
       logger.error('Permission denied accessing Docker socket', { error });
     }
   }
   ```

### Error Recovery

```js
async function withRetry(operation, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * attempt, 10000)));
      }
    }
  }
  throw lastError;
}
```

## Best Practices

### Resource Management

1. **Stream Cleanup**

   ```js
   function cleanupStream(stream) {
     if (stream && !stream.destroyed) {
       stream.destroy();
     }
   }
   ```

2. **Memory Usage**
   ```js
   // Configure stream buffer size
   const maxBuffer = process.env.STATS_BUFFER_SIZE || 1048576; // 1MB
   stream.setMaxListeners(0);
   stream.setEncoding('utf8');
   ```

### Performance

1. **Efficient Filtering**

   ```js
   // Filter containers efficiently
   const filters = {
     status: ['running']
   };
   ```

2. **Connection Pooling**
   ```js
   // Reuse Docker client
   const docker = new Docker({
     socketPath: '/var/run/docker.sock',
     pool: {
       maxSockets: 10
     }
   });
   ```

## Troubleshooting

### Common Issues

1. **Socket Connection**

   - Check socket path
   - Verify permissions
   - Test Docker daemon

2. **Stream Issues**
   - Monitor memory usage
   - Check for leaks
   - Handle backpressure

### Debugging

```js
// Enable debug logging
const debug = require('debug')('docker-stats:stream');

debug('Creating stream for container %s', containerId);
debug('Stats received: %o', stats);
debug('Error occurred: %o', error);
```

## Further Reading

- [Docker Engine API](https://docs.docker.com/engine/api/v1.41/#operation/ContainerStats)
- [Dockerode Documentation](https://github.com/apocas/dockerode)
- [Stream Management](stream.md)
- [Metrics Guide](metrics.md)
