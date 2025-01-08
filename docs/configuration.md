# Configuration Guide

This guide details all configuration options available in the Docker Stats Service.

## Environment Variables

### Logging and Runtime Settings

| Variable              | Description                           | Default | Required |
| --------------------- | ------------------------------------- | ------- | -------- |
| `LOG_LEVEL`           | Logging verbosity level               | `info`  | No       |
| `DEBUG`               | Debug patterns for detailed logging   | -       | No       |
| `SHUTDOWN_TIMEOUT_MS` | Maximum time for graceful shutdown    | `10000` | No       |
| `DOCKER`              | Whether running in Docker environment | `false` | No       |

Supported `LOG_LEVEL` values:

- `trace` - Most verbose logging
- `debug` - Detailed debugging information
- `info` - General operational information
- `warn` - Warning messages
- `error` - Error messages only
- `silent` - No logging output

Debug patterns for `DEBUG`:

- `docker-stats:*` - All debug logs
- `docker-stats:stream` - Stream-related logs only
- `docker-stats:events` - Docker events logs only

### Core Settings

| Variable              | Description                               | Default                | Required |
| --------------------- | ----------------------------------------- | ---------------------- | -------- |
| `DOCKER_SOCKET_PATH`  | Path to Docker socket                     | `/var/run/docker.sock` | No       |
| `STATS_BUFFER_SIZE`   | Size of stats stream buffer in bytes      | `1048576`              | No       |
| `STATS_LINE_SIZE`     | Maximum size of a single stats line       | `102400`               | No       |
| `STATS_PARSE_TIMEOUT` | Timeout for parsing stats in milliseconds | `30000`                | No       |

### InfluxDB Configuration (v1.X)

| Variable                   | Description                    | Default        | Required |
| -------------------------- | ------------------------------ | -------------- | -------- |
| `INFLUXDB_HOST`            | InfluxDB server host           | `localhost`    | No       |
| `INFLUXDB_PORT`            | InfluxDB server port           | `8086`         | No       |
| `INFLUXDB_PROTOCOL`        | InfluxDB protocol (http/https) | `http`         | No       |
| `INFLUXDB_USER`            | InfluxDB username              | `admin`        | No       |
| `INFLUXDB_PASS`            | InfluxDB password              | `admin`        | No       |
| `INFLUXDB_DB`              | InfluxDB database name         | `docker-stats` | No       |
| `INFLUXDB_RETRY_MAX`       | Maximum retry attempts         | `5`            | No       |
| `INFLUXDB_RETRY_DELAY`     | Initial retry delay in ms      | `1000`         | No       |
| `INFLUXDB_RETRY_MAX_DELAY` | Maximum retry delay in ms      | `10000`        | No       |

### Metrics Configuration

| Variable         | Description                    | Default        | Required |
| ---------------- | ------------------------------ | -------------- | -------- |
| `BATCH_SIZE`     | Maximum points per batch       | `100`          | No       |
| `BATCH_WAIT_MS`  | Maximum wait time before flush | `2000`         | No       |
| `METRICS_PREFIX` | Prefix for all metrics         | `docker_stats` | No       |

## Docker Configuration

### Socket Access

The service requires access to the Docker socket. There are several ways to provide this access securely:

1. **For Local Development**

   Add your user to the `docker` group (preferred over changing socket permissions):

   ```bash
   # Add current user to docker group
   sudo usermod -aG docker $USER

   # Apply changes (requires logout/login or run this command)
   newgrp docker

   # Verify access
   docker ps
   ```

2. **For Container Deployment**

   Use the Docker socket mount with appropriate user/group:

   ```yaml
   version: '3.8'
   services:
     docker-stats:
       image: docker-stats-service
       volumes:
         - /var/run/docker.sock:/var/run/docker.sock
       # Optional: Run as specific user/group that has Docker access
       user: '${UID}:${GID}'
   ```

> **Security Note**:
>
> - Only add users to the docker group who need to access Docker, as this grants significant system privileges
> - In production environments, consider using rootless Docker or a more restrictive security model
> - Avoid changing socket permissions (chmod) as it can introduce security risks

## Grafana Dashboard Configuration

### Default Dashboards

The service comes with pre-configured dashboards located in `docker/grafana_config/dashboards/`:

```
docker/grafana_config/dashboards/
└── docker-stats-dashboard.json    # Main container stats
```

### Adding Custom Dashboards

1. **Export Your Dashboard**

   - In Grafana UI, click Share Dashboard → Export
   - Select "Export for sharing externally"
   - Save as JSON file

2. **Install New Dashboard**

   ```bash
   # Copy your dashboard JSON
   cp your-dashboard.json docker/grafana_config/dashboards/

   # Restart Grafana to load new dashboard
   docker compose -f docker/docker-compose.yml restart grafana
   ```

3. **Dashboard Naming**
   - Use descriptive filenames (e.g., `network-metrics-dashboard.json`)
   - Ensure `.json` extension
   - Avoid spaces in filenames

### Customizing Dashboards

1. **Data Source Configuration**

   ```json
   {
     "datasource": {
       "type": "influxdb",
       "uid": "influx-docker-stats"
     }
   }
   ```

2. **Available Metrics**

   ```sql
   -- CPU Usage
   FROM "docker_stats_cpu" WHERE container_name = '$container'

   -- Memory Usage
   FROM "docker_stats_memory" WHERE container_name = '$container'

   -- Network I/O
   FROM "docker_stats_network" WHERE container_name = '$container'
   ```

3. **Variables**
   - `$container`: Container name
   - `$interval`: Time interval
   - `$host`: Host system

### Auto-Provisioning

Dashboards are automatically provisioned through Docker Compose:

```yaml
services:
  grafana:
    volumes:
      - ./grafana_config/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana_config/datasources:/etc/grafana/provisioning/datasources
```

> **Note**: Changes to dashboard JSON files require a Grafana restart to take effect.

### Best Practices

1. **Version Control**

   - Keep dashboard JSONs in version control
   - Document dashboard changes in commit messages
   - Include screenshots for visual changes

2. **Organization**

   - Use folders for different dashboard types
   - Follow consistent naming conventions
   - Include README in dashboard directory

3. **Backup**
   ```bash
   # Backup all dashboards
   cp -r docker/grafana_config/dashboards/ backup/dashboards-$(date +%Y%m%d)
   ```
