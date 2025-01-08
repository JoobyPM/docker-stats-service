# Metrics Schema Reference

This document details the schema of metrics collected and stored by the Docker Stats Service.

## Overview

All metrics are stored in InfluxDB using the line protocol format with appropriate tags and fields.

## Metric Types

### CPU Metrics

**Measurement**: `docker_stats_cpu`

**Tags**:

- `container_id`: Container ID
- `container_name`: Container name
- `image`: Container image name
- `host`: Host machine name

**Fields**:

```
{
  usage_percent: 45.2,      // Total CPU usage percentage
  system_percent: 12.8,     // System CPU usage percentage
  user_percent: 32.4,       // User CPU usage percentage
  throttling_count: 0,      // Number of throttling periods
  throttling_time_ns: 0     // Total throttling time in nanoseconds
}
```

### Memory Metrics

**Measurement**: `docker_stats_memory`

**Tags**:

- `container_id`: Container ID
- `container_name`: Container name
- `image`: Container image name
- `host`: Host machine name

**Fields**:

```
{
  usage_bytes: 1024576,     // Current memory usage in bytes
  max_usage_bytes: 2097152, // Maximum memory usage in bytes
  limit_bytes: 4194304,     // Memory limit in bytes
  usage_percent: 48.9,      // Memory usage percentage
  cache_bytes: 524288,      // Cache memory in bytes
  rss_bytes: 500288,        // RSS memory in bytes
  swap_bytes: 0             // Swap usage in bytes
}
```

### Network Metrics

**Measurement**: `docker_stats_network`

**Tags**:

- `container_id`: Container ID
- `container_name`: Container name
- `image`: Container image name
- `host`: Host machine name
- `interface`: Network interface name

**Fields**:

```
{
  rx_bytes: 1024,          // Received bytes
  tx_bytes: 512,           // Transmitted bytes
  rx_packets: 42,          // Received packets
  tx_packets: 21,          // Transmitted packets
  rx_dropped: 0,           // Dropped incoming packets
  tx_dropped: 0,           // Dropped outgoing packets
  rx_errors: 0,            // Receive errors
  tx_errors: 0             // Transmit errors
}
```

### Block I/O Metrics

**Measurement**: `docker_stats_blockio`

**Tags**:

- `container_id`: Container ID
- `container_name`: Container name
- `image`: Container image name
- `host`: Host machine name
- `device`: Block device name

**Fields**:

```
{
  read_bytes: 4096,        // Bytes read
  write_bytes: 8192,       // Bytes written
  read_ops: 2,             // Read operations
  write_ops: 4,            // Write operations
  async_bytes: 0,          // Async I/O bytes
  sync_bytes: 12288,       // Sync I/O bytes
  async_ops: 0,            // Async I/O operations
  sync_ops: 6              // Sync I/O operations
}
```

### PIDs Metrics

**Measurement**: `docker_stats_pids`

**Tags**:

- `container_id`: Container ID
- `container_name`: Container name
- `image`: Container image name
- `host`: Host machine name

**Fields**:

```
{
  current: 12,             // Current number of processes
  limit: 4096             // Process limit
}
```

## Container Events

**Measurement**: `docker_events`

**Tags**:

- `container_id`: Container ID
- `container_name`: Container name
- `image`: Container image name
- `host`: Host machine name
- `event_type`: Event type (start, stop, die, etc.)

**Fields**:

```
{
  timestamp: 1642612345,   // Event timestamp
  status: "start",         // Event status
  exit_code: 0            // Exit code (for stop/die events)
}
```

## Example Queries

### CPU Usage Over Time

```flux
from(bucket: "docker_metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "docker_stats_cpu")
  |> filter(fn: (r) => r.container_name == "web-1")
  |> filter(fn: (r) => r._field == "usage_percent")
```

### Memory Usage by Container

```flux
from(bucket: "docker_metrics")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "docker_stats_memory")
  |> filter(fn: (r) => r._field == "usage_percent")
  |> group(columns: ["container_name"])
  |> mean()
```

### Network Traffic Rate

```flux
from(bucket: "docker_metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "docker_stats_network")
  |> filter(fn: (r) => r._field =~ /bytes$/)
  |> derivative(unit: 1s)
```

## Schema Evolution

### Version History

1. **v1.0.0**

   - Initial schema
   - Basic metrics support

2. **v1.1.0**

   - Added PIDs metrics
   - Enhanced network metrics

3. **v1.2.0**
   - Added container events
   - Extended block I/O metrics

### Compatibility

- Schema changes are backward compatible
- New fields are additive
- Existing fields maintain types
- Tags remain consistent

## Best Practices

### Querying

1. **Time Ranges**

   - Use appropriate time ranges
   - Consider data retention
   - Optimize for performance

2. **Aggregations**
   - Group by relevant tags
   - Use suitable functions
   - Consider cardinality

### Storage

1. **Retention**

   - Set appropriate policies
   - Archive historical data
   - Monitor storage usage

2. **Performance**
   - Index important tags
   - Optimize queries
   - Monitor write performance

## Further Reading

- [InfluxDB Line Protocol](https://docs.influxdata.com/influxdb/v2.7/reference/syntax/line-protocol/)
- [Metrics Collection](../guides/metrics.md)
- [Configuration](../configuration.md)
