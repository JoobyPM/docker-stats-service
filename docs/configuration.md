# Configuration Guide

This guide covers all configuration options for the Docker Stats Service.

## Environment Variables

### Core Settings

| Variable             | Description                   | Default                | Required |
| -------------------- | ----------------------------- | ---------------------- | -------- |
| `DOCKER`             | Running in Docker environment | `false`                | No       |
| `LOG_LEVEL`          | Logging verbosity             | `info`                 | No       |
| `DOCKER_SOCKET_PATH` | Path to Docker socket         | `/var/run/docker.sock` | No       |

### InfluxDB Configuration

| Variable            | Description       | Default                                 | Required |
| ------------------- | ----------------- | --------------------------------------- | -------- |
| `INFLUXDB_HOST`     | InfluxDB host     | `localhost` or `host.docker.internal`\* | No       |
| `INFLUXDB_PORT`     | InfluxDB port     | `8086`                                  | No       |
| `INFLUXDB_PROTOCOL` | InfluxDB protocol | `http`                                  | No       |
| `INFLUXDB_USER`     | InfluxDB username | `admin`                                 | No       |
| `INFLUXDB_PASS`     | InfluxDB password | `admin`                                 | No       |
| `INFLUXDB_DB`       | Database name     | `docker-stats`                          | No       |

\*Defaults to `host.docker.internal` when `DOCKER=true`

### Performance Tuning

| Variable            | Description              | Default   | Required |
| ------------------- | ------------------------ | --------- | -------- |
| `BATCH_SIZE`        | Max points per batch     | `100`     | No       |
| `BATCH_WAIT_MS`     | Max batch wait time      | `2000`    | No       |
| `STATS_BUFFER_SIZE` | Stats stream buffer size | `1048576` | No       |
| `STATS_LINE_SIZE`   | Max stats line size      | `102400`  | No       |

### Error Handling

| Variable                   | Description               | Default | Required |
| -------------------------- | ------------------------- | ------- | -------- |
| `INFLUXDB_RETRY_MAX`       | Max retry attempts        | `5`     | No       |
| `INFLUXDB_RETRY_DELAY`     | Initial retry delay (ms)  | `1000`  | No       |
| `INFLUXDB_RETRY_MAX_DELAY` | Max retry delay (ms)      | `10000` | No       |
| `SHUTDOWN_TIMEOUT_MS`      | Graceful shutdown timeout | `10000` | No       |
| `STATS_PARSE_TIMEOUT`      | Stats parsing timeout     | `30000` | No       |

## Docker Configuration

### Docker Compose

Example `docker-compose.yml`:

```yaml
version: '3.8'
services:
  docker-stats:
    image: docker-stats-service
    environment:
      - DOCKER=true
      - LOG_LEVEL=info
      - INFLUXDB_HOST=influxdb
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      - influxdb
```

### Docker Socket Access

The service requires access to the Docker socket:

1. **Socket Mounting**

   ```yaml
   volumes:
     - /var/run/docker.sock:/var/run/docker.sock
   ```

2. **Permissions**

   ```bash
   # Check permissions
   ls -l /var/run/docker.sock

   # Fix if needed
   sudo chmod 666 /var/run/docker.sock
   ```

## Local Development

For local development:

1. **Environment File**
   Create `.env` in project root:

   ```bash
   LOG_LEVEL=debug
   INFLUXDB_HOST=localhost
   ```

2. **Development Settings**

   ```bash
   # Start with debug logging
   LOG_LEVEL=debug pnpm start

   # Custom InfluxDB connection
   INFLUXDB_HOST=custom.host pnpm start
   ```

## Advanced Configuration

### Metrics Batching

The service implements efficient metrics batching:

1. **Batch Size**

   - Larger `BATCH_SIZE` = more memory, fewer writes
   - Smaller `BATCH_SIZE` = less memory, more writes

2. **Batch Timing**
   - `BATCH_WAIT_MS` controls maximum wait time
   - Batches flush on size or time limit

### Error Recovery

Configure retry behavior:

1. **Retry Settings**

   - `INFLUXDB_RETRY_MAX`: Maximum attempts
   - `INFLUXDB_RETRY_DELAY`: Initial delay
   - `INFLUXDB_RETRY_MAX_DELAY`: Maximum delay

2. **Timeouts**
   - `SHUTDOWN_TIMEOUT_MS`: Graceful shutdown
   - `STATS_PARSE_TIMEOUT`: Stats processing

## Best Practices

1. **Production Settings**

   - Use explicit host configurations
   - Set appropriate batch sizes
   - Configure proper timeouts
   - Enable error retries

2. **Development Settings**

   - Enable debug logging
   - Use smaller batch sizes
   - Reduce timeouts
   - Configure local hosts

3. **Resource Considerations**
   - Monitor memory usage
   - Adjust batch settings
   - Watch for timeouts
   - Check error rates
