# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Docker Stats Service.

## Common Issues

### Docker Socket Access

**Problem**: Cannot access Docker socket

```
Error: connect ECONNREFUSED /var/run/docker.sock
```

**Solution**:

1. Check socket permissions:

   ```bash
   ls -l /var/run/docker.sock
   ```

2. Fix permissions if needed:

   ```bash
   sudo chmod 666 /var/run/docker.sock
   ```

3. Verify Docker daemon is running:
   ```bash
   docker info
   ```

### InfluxDB Connection

**Problem**: Cannot connect to InfluxDB

```
Error: Failed to write to InfluxDB
```

**Solution**:

1. Check InfluxDB status:

   ```bash
   curl -I http://localhost:8086/ping
   ```

2. Verify credentials:

   ```bash
   # Test with influx CLI
   influx -host localhost -port 8086 -database docker_stats
   ```

3. Check network connectivity:
   ```bash
   telnet localhost 8086
   ```

### Stream Issues

**Problem**: Stats streams not working

```
Error: Stream closed unexpectedly
```

**Solution**:

1. Check Docker logs:

   ```bash
   docker logs docker-stats-service
   ```

2. Verify container status:

   ```bash
   docker ps -a
   ```

3. Restart the service:
   ```bash
   docker-compose restart docker-stats
   ```

### Memory Issues

**Problem**: High memory usage

```
Error: JavaScript heap out of memory
```

**Solution**:

1. Adjust batch settings:

   ```bash
   BATCH_SIZE=50
   BATCH_WAIT_MS=1000
   ```

2. Monitor memory usage:

   ```bash
   docker stats docker-stats-service
   ```

3. Check for memory leaks:
   ```bash
   # Enable debug logging
   DEBUG=docker-stats:* docker-compose up docker-stats
   ```

## Service Diagnostics

### Check Service Status

```bash
# View service status
docker-compose ps

# Check service logs
docker-compose logs -f docker-stats
```

### Verify Metrics Collection

```bash
# Query recent metrics
influx -database docker_stats -execute 'SELECT * FROM docker_stats_cpu WHERE time > now() - 5m'
```

### Debug Mode

Enable debug logging:

```bash
# In docker-compose.yml
environment:
  - DEBUG=docker-stats:*
```

## Recovery Steps

### Service Recovery

1. Stop the service:

   ```bash
   docker-compose stop docker-stats
   ```

2. Clear any stale state:

   ```bash
   docker-compose rm -f docker-stats
   ```

3. Restart the service:
   ```bash
   docker-compose up -d docker-stats
   ```

### Data Recovery

1. Check InfluxDB status:

   ```bash
   influx -execute 'SHOW DATABASES'
   ```

2. Verify data:

   ```bash
   influx -database docker_stats -execute 'SHOW MEASUREMENTS'
   ```

3. Repair database if needed:

   ```bash
   # Backup first
   influxd backup /path/to/backup

   # Restore if needed
   influxd restore /path/to/backup
   ```

## Prevention

### Best Practices

1. Regular Monitoring:

   - Watch service logs
   - Monitor memory usage
   - Check error rates

2. Configuration:

   - Use appropriate batch sizes
   - Configure proper timeouts
   - Set memory limits

3. Maintenance:
   - Regular service updates
   - InfluxDB maintenance
   - Log rotation

## Getting Help

If issues persist:

1. Check the [ReadMe](../README.md) or [documentation](index.md)
2. Review service logs
3. Open an issue on GitHub with:
   - Error messages
   - Service logs
   - Configuration details
