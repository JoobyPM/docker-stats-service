# Metrics Collection and Batching

This guide explains how the Docker Stats Service collects and processes container metrics.

## Metrics Flow

### Collection Process

1. **Stats Stream**

   - Docker API connection
   - Real-time stats streaming
   - Raw JSON data

2. **Processing Pipeline**

   ```
   Raw Stats → Parse → Validate → Transform → Batch → Store
   ```

3. **Data Flow**
   - Stream Manager receives stats
   - Parser processes JSON
   - Metrics formatted for InfluxDB

## Metric Types

### Resource Metrics

1. **CPU Usage**

   ```
   {
     measurement: 'cpu',
     tags: {
       container_id: 'abc123',
       container_name: 'web-1'
     },
     fields: {
       usage_percent: 45.2,
       system_percent: 12.8,
       user_percent: 32.4
     }
   }
   ```

2. **Memory Usage**
   ```
   {
     measurement: 'memory',
     tags: {
       container_id: 'abc123',
       container_name: 'web-1'
     },
     fields: {
       usage_bytes: 1024576,
       limit_bytes: 2097152,
       usage_percent: 48.9
     }
   }
   ```

### Network Metrics

```
{
  measurement: 'network',
  tags: {
    container_id: 'abc123',
    container_name: 'web-1',
    interface: 'eth0'
  },
  fields: {
    rx_bytes: 1024,
    tx_bytes: 512,
    rx_packets: 42,
    tx_packets: 21
  }
}
```

### Block I/O Metrics

```
{
  measurement: 'blockio',
  tags: {
    container_id: 'abc123',
    container_name: 'web-1',
    device: '/dev/sda1'
  },
  fields: {
    read_bytes: 4096,
    write_bytes: 8192,
    read_ops: 2,
    write_ops: 4
  }
}
```

## Batching Strategy

### Batch Configuration

1. **Batch Settings**

   ```js
   const batchConfig = {
     size: 1000, // Points per batch
     intervalMs: 10000, // Flush interval
     retries: 3 // Write retries
   };
   ```

2. **Memory Management**
   - Buffer size limits
   - Backpressure handling
   - Resource monitoring

### Batch Processing

1. **Collection**

   - Accumulate points
   - Track batch size
   - Monitor memory

2. **Flushing**
   - Time-based flush
   - Size-based flush
   - Manual flush

## Performance Optimization

### Batching Efficiency

1. **Batch Size**

   - Optimal point count
   - Memory usage
   - Network efficiency

2. **Flush Timing**
   - Latency vs throughput
   - Resource usage
   - Data freshness

### Resource Usage

1. **Memory**

   - Buffer allocation
   - Batch size limits
   - Cleanup strategy

2. **Network**
   - Connection pooling
   - Compression
   - Retry handling

## Best Practices

### Configuration

1. **Batch Size**

   ```js
   // High-throughput settings
   const config = {
     batchSize: 5000, // Larger batches
     flushInterval: 5000, // Faster flush
     compression: true // Enable compression
   };
   ```

2. **Resource Limits**
   ```js
   // Resource constraints
   const limits = {
     maxBatchSize: 10000,
     maxBufferSize: '50MB',
     maxRetries: 5
   };
   ```

### Monitoring

1. **Batch Metrics**

   - Batch sizes
   - Flush frequency
   - Write success rate

2. **Performance Metrics**
   - Processing time
   - Memory usage
   - Network latency

## Troubleshooting

### Common Issues

1. **Memory Pressure**

   - Reduce batch size
   - Increase flush frequency
   - Monitor buffer usage

2. **Write Failures**
   - Check connectivity
   - Verify permissions
   - Adjust retry settings

### Performance Issues

1. **High Latency**

   - Optimize batch size
   - Adjust flush interval
   - Check network

2. **Resource Usage**
   - Monitor memory
   - Check CPU usage
   - Verify network capacity

## Further Reading

- [Stream Management](stream.md)
- [Error Handling](../reference/error-handling.md)
- [InfluxDB Line Protocol](https://docs.influxdata.com/influxdb/v2.7/reference/syntax/line-protocol/)
