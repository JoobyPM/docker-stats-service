# Stream Management

This guide explains how the Docker Stats Service manages container stats streams.

## Stream Lifecycle

### Stream States

```
[Container Start] → STARTING → ACTIVE → STOPPING → STOPPED
       ↑              ↓         ↓
       └──────────────┴─────────┘
        (Auto-retry on error)
```

1. **STARTING**

   - Stream creation initiated
   - Resources allocated
   - Connection established

2. **ACTIVE**

   - Receiving stats data
   - Processing metrics
   - Handling backpressure

3. **STOPPING**

   - Cleanup initiated
   - Final data processed
   - Resources released

4. **STOPPED**
   - Stream closed
   - Resources freed
   - Ready for removal

## Stream Management

### Creation Process

1. **Container Detection**

   ```js
   // Container discovered or started
   await streamManager.addStream(containerId, containerName);
   ```

2. **Stream Setup**

   - Docker stats stream opened
   - Event handlers attached
   - State tracking initialized

3. **Error Handling**
   - Connection errors caught
   - Automatic retry logic
   - State management

### Stream Monitoring

1. **Health Checks**

   - Stream status verification
   - Error detection
   - Performance monitoring

2. **Backpressure Handling**
   - Buffer monitoring
   - Flow control
   - Resource management

## Error Recovery

### Retry Logic

1. **Error Detection**

   - Network issues
   - Docker API errors
   - Parse failures

2. **Recovery Process**

   ```
   Error → State: ERROR → Retry → STARTING → ACTIVE
   ```

3. **Retry Limits**
   - Maximum attempts tracked
   - Exponential backoff
   - Final failure handling

## Resource Management

### Memory Usage

1. **Buffer Configuration**

   ```bash
   STATS_BUFFER_SIZE=1048576    # Stream buffer size
   STATS_LINE_SIZE=102400       # Maximum line size
   ```

2. **Resource Cleanup**
   - Proper stream closure
   - Memory release
   - Connection cleanup

### Concurrency

1. **Stream Pooling**

   - One stream per container
   - Resource sharing
   - Connection pooling

2. **Load Management**
   - Concurrent stream limits
   - Resource allocation
   - Performance optimization

## Best Practices

### Configuration

1. **Buffer Sizes**

   ```bash
   # For high-throughput containers
   STATS_BUFFER_SIZE=2097152    # 2MB buffer
   STATS_LINE_SIZE=204800       # 200KB line size
   ```

2. **Error Handling**
   ```bash
   # Aggressive retry for unstable networks
   STATS_PARSE_TIMEOUT=60000    # 60s timeout
   ```

### Monitoring

1. **Stream Health**

   - Watch error rates
   - Monitor memory usage
   - Check stream states

2. **Performance Tuning**
   - Adjust buffer sizes
   - Configure timeouts
   - Optimize retry settings

## Troubleshooting

### Common Issues

1. **Stream Failures**

   - Check Docker daemon
   - Verify permissions
   - Monitor network

2. **Memory Leaks**
   - Verify cleanup
   - Check buffer sizes
   - Monitor resource usage

## Further Reading

- [Metrics Collection](metrics.md)
- [Error Handling](../reference/error-handling.md)
- [Docker API](https://docs.docker.com/engine/api/v1.41/#operation/ContainerStats)
