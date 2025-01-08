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
      "total_usage": 1234567890,
      "percpu_usage": [123456, 234567],
      "usage_in_kernelmode": 123456,
      "usage_in_usermode": 234567
    },
    "system_cpu_usage": 9876543210,
    "online_cpus": 2
  },
  "memory_stats": {
    "usage": 1024576,
    "max_usage": 2097152,
    "limit": 4194304
  },
  "networks": {
    "eth0": {
      "rx_bytes": 1024,
      "tx_bytes": 512
    }
  },
  "blkio_stats": {
    "io_service_bytes_recursive": [
      {
        "major": 8,
        "minor": 0,
        "op": "Read",
        "value": 4096
      }
    ]
  }
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
    // Process stats data
  });

  stream.on('error', error => {
    // Handle stream error
  });

  stream.on('end', () => {
    // Handle stream end
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
       // Container not found
     }
   }
   ```

2. **Permission Denied**
   ```js
   try {
     await createStatsStream(containerId);
   } catch (error) {
     if (error.statusCode === 403) {
       // Permission denied
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
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
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
   const maxBuffer = 1024 * 1024; // 1MB
   stream.setMaxListeners(0);
   stream.setEncoding('utf8');
   ```

### Performance

1. **Efficient Filtering**

   ```js
   // Filter containers efficiently
   const filters = {
     status: ['running'],
     label: ['com.example.monitor=true']
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
const debug = require('debug')('docker-stats');

debug('Creating stream for container %s', containerId);
debug('Stats received: %o', stats);
debug('Error occurred: %o', error);
```

## Further Reading

- [Docker Engine API](https://docs.docker.com/engine/api/v1.41/)
- [Dockerode Documentation](https://github.com/apocas/dockerode)
- [Stream Management](stream.md)
