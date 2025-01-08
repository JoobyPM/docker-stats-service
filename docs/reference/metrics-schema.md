# Metrics Schema Reference

This document details the schema of metrics collected and stored by the Docker Stats Service.

## Overview

All metrics are stored in InfluxDB using the line protocol format with appropriate tags and fields under a single measurement named `docker_stats`.

## Measurement Schema

### Measurement Name

All metrics are stored under the measurement: `docker_stats`

### Tags

- `container_id`: Container ID
- `container_name`: Container name

### Available Fields

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

## Example Queries

### CPU Usage and Throttling

```sql
SELECT cpu_percent, cpu_total_usage, cpu_throttled_time,
       cpu_throttled_periods, cpu_throttling_periods
FROM docker_stats
WHERE container_name = 'docker-stats-service'
  AND time > now() - 1h
LIMIT 3
```

### Memory Analysis

```sql
SELECT mem_used, mem_total,
       mem_active_anon, mem_inactive_anon,
       mem_active_file, mem_inactive_file,
       mem_pgfault, mem_pgmajfault
FROM docker_stats
WHERE container_name = 'docker-stats-service'
  AND time > now() - 5m
LIMIT 3
```

### Network Interface Statistics

```sql
SELECT net_eth0_in_bytes, net_eth0_out_bytes,
       net_eth0_in_packets, net_eth0_out_packets,
       net_eth0_in_errors, net_eth0_out_errors
FROM docker_stats
WHERE container_name = 'docker-stats-service'
  AND time > now() - 1h
LIMIT 3
```

### Block I/O Monitoring

```sql
SELECT non_negative_derivative(blkio_read_bytes, 1s) as read_rate,
       non_negative_derivative(blkio_write_bytes, 1s) as write_rate
FROM docker_stats
WHERE container_name = 'docker-stats-service'
  AND time > now() - 30m
LIMIT 3
```

### Process and Resource Metrics

```sql
SELECT pids_current, num_procs, cpu_online,
       cpu_system_usage, cpu_usage_in_kernelmode,
       cpu_usage_in_usermode
FROM docker_stats
WHERE container_name = 'docker-stats-service'
  AND time > now() - 15m
LIMIT 3
```

## Schema Evolution

### Version History

1. **v1.0.0**

   - Initial schema with basic metrics

2. **v1.1.0**

   - Added detailed memory stats
   - Added CPU throttling metrics
   - Added per-interface network stats

3. **v1.2.0**
   - Added timestamp metrics
   - Added process metrics
   - Enhanced block I/O metrics

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

- [InfluxDB Line Protocol](https://docs.influxdata.com/influxdb/v1.8/write_protocols/line_protocol_reference/)
- [Metrics Collection](../guides/metrics.md)
- [Configuration](../configuration.md)
