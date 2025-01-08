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
   Raw Stats → Parse → Transform → Batch → Store
   ```

3. **Data Flow**
   - Stream Manager receives stats
   - Parser processes JSON
   - Metrics formatted for InfluxDB

## Metric Types

All metrics are stored in a single measurement named `docker_stats` with the following structure:

### Tags

```
{
  container_id: "abc123",              // Container ID
  container_name: "web-1"              // Container name
}
```

### Fields

#### CPU Metrics

```
{
  cpu_percent: 45.2,                    // CPU usage percentage
  cpu_total_usage: 406981000,           // Total CPU usage in nanoseconds
  cpu_system_usage: 2800680000000,      // System CPU usage in nanoseconds
  cpu_online: 16,                       // Number of online CPUs
  cpu_usage_in_kernelmode: 51890000,    // CPU usage in kernel mode
  cpu_usage_in_usermode: 355091000,     // CPU usage in user mode
  cpu_throttling_periods: 11,           // Number of throttling periods
  cpu_throttled_periods: 8,             // Number of periods where CPU was throttled
  cpu_throttled_time: 584099000         // Total time CPU was throttled
}
```

#### Memory Metrics

```
{
  mem_used: 80269312,                   // Current memory usage in bytes
  mem_total: 268435456,                 // Memory limit in bytes
  mem_active_anon: 75771904,            // Active anonymous memory
  mem_inactive_anon: 0,                 // Inactive anonymous memory
  mem_active_file: 0,                   // Active file-backed memory
  mem_inactive_file: 0,                 // Inactive file-backed memory
  mem_unevictable: 0,                   // Memory that cannot be reclaimed
  mem_pgfault: 12345,                   // Number of page faults
  mem_pgmajfault: 0                     // Number of major page faults
}
```

#### Network Metrics

```
{
  net_in_bytes: 1574,                   // Total bytes received
  net_out_bytes: 568,                   // Total bytes transmitted
  net_eth0_in_bytes: 1574,              // Bytes received on eth0
  net_eth0_out_bytes: 568,              // Bytes transmitted on eth0
  net_eth0_in_packets: 14,              // Packets received on eth0
  net_eth0_out_packets: 7,              // Packets transmitted on eth0
  net_eth0_in_errors: 0,                // Receive errors on eth0
  net_eth0_out_errors: 0,               // Transmit errors on eth0
  net_eth0_in_dropped: 0,               // Packets dropped on receive (eth0)
  net_eth0_out_dropped: 0               // Packets dropped on transmit (eth0)
}
```

#### Block I/O Metrics

```
{
  blkio_read_bytes: 4096,               // Total bytes read from disk
  blkio_write_bytes: 8192               // Total bytes written to disk
}
```

#### Process Metrics

```
{
  pids_current: 22,                     // Current number of processes
  num_procs: 22                         // Total number of processes
}
```

#### Timestamp Metrics

```
{
  read_time: 1642612345000,             // Current stats collection timestamp
  preread_time: 1642612344000           // Previous stats collection timestamp
}
```

## Batching Strategy

### Batch Configuration

1. **Batch Settings**

   ```js
   const batchConfig = {
     size: process.env.BATCH_SIZE || 100, // Points per batch
     waitMs: process.env.BATCH_WAIT_MS || 2000 // Flush interval
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
   - Time-based flush (every `BATCH_WAIT_MS` milliseconds)
   - Size-based flush (when batch reaches `BATCH_SIZE` points)
   - Manual flush on shutdown

## Performance Optimization

### Batching Efficiency

1. **Batch Size**

   - Default: 100 points
   - Configurable via `BATCH_SIZE`
   - Balance between memory and write frequency

2. **Flush Timing**
   - Default: 2000ms
   - Configurable via `BATCH_WAIT_MS`
   - Balance between latency and throughput

### Resource Usage

1. **Memory**

   - Efficient point format
   - Regular flushing
   - Backpressure handling

2. **Network**
   - Batched writes
   - Connection reuse
   - Error handling with retries

## Best Practices

### Configuration

1. **Batch Size**

   ```bash
   # High-throughput settings
   export BATCH_SIZE=500
   export BATCH_WAIT_MS=5000
   ```

2. **Resource Limits**
   ```bash
   # Memory-constrained environments
   export BATCH_SIZE=50
   export BATCH_WAIT_MS=1000
   ```

### Monitoring

1. **Batch Metrics**

   - Points per batch
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
   - Check InfluxDB connection
   - Verify permissions
   - Check error logs

### Performance Issues

1. **High Latency**

   - Optimize batch size
   - Adjust flush interval
   - Check network connectivity

2. **Resource Usage**
   - Monitor memory usage
   - Check CPU utilization
   - Verify network capacity

## Further Reading

- [Metrics Schema Reference](../reference/metrics-schema.md)
- [Configuration Guide](../configuration.md)
- [Stream Management](stream.md)
- [Error Handling](../reference/error-handling.md)
