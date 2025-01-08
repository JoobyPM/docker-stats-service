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
| `STATS_FIELDS`        | Fields to collect and store in InfluxDB   | `""`                   | No       |

#### STATS_FIELDS Configuration

The `STATS_FIELDS` variable controls which metrics are collected and stored in InfluxDB. It supports three modes:

1. **All Fields** (Default)

   ```bash
   STATS_FIELDS=""  # Empty value collects all available fields
   ```

2. **Essential Fields Only**

   ```bash
   STATS_FIELDS="ESSENTIAL"  # Collects core metrics only (CPU, memory, network)
   ```

3. **Custom Field Selection**

   ```bash
   # Example: Basic monitoring
   STATS_FIELDS="cpu_percent,mem_used,pids_current"

   # Example: Network-focused monitoring
   STATS_FIELDS="net_in_bytes,net_out_bytes,net_eth0_in_packets,net_eth0_out_packets"

   # Example: Detailed memory analysis
   STATS_FIELDS="mem_used,mem_cache,mem_active_anon,mem_inactive_anon,mem_pgfault"

   # Example: I/O monitoring
   STATS_FIELDS="blkio_read_bytes,blkio_write_bytes,blkio_sync_bytes"
   ```

#### Available Metrics Fields

Below are all available fields that can be collected, grouped by category:

##### CPU Metrics

| Field Name                | Description                               |
| ------------------------- | ----------------------------------------- |
| `cpu_percent`             | CPU usage percentage                      |
| `cpu_total_usage`         | Total CPU usage in nanoseconds            |
| `cpu_system_usage`        | System CPU usage in nanoseconds           |
| `cpu_online`              | Number of online CPUs                     |
| `cpu_usage_in_kernelmode` | CPU usage in kernel mode                  |
| `cpu_usage_in_usermode`   | CPU usage in user mode                    |
| `cpu_throttling_periods`  | Number of throttling periods              |
| `cpu_throttled_periods`   | Number of periods where CPU was throttled |
| `cpu_throttled_time`      | Total time CPU was throttled              |
| `cpu_[N]_usage`           | Usage per CPU core (N = core number)      |

##### Memory Metrics

| Field Name                | Description                            |
| ------------------------- | -------------------------------------- |
| `mem_used`                | Current memory usage in bytes          |
| `mem_total`               | Memory limit in bytes                  |
| `mem_max`                 | Maximum memory usage recorded          |
| `mem_failcnt`             | Number of memory usage hits limits     |
| `mem_cache`               | Page cache memory                      |
| `mem_rss`                 | Anonymous and swap cache               |
| `mem_rss_huge`            | Number of resident huge pages          |
| `mem_mapped_file`         | Size of memory-mapped files            |
| `mem_active_anon`         | Active anonymous memory                |
| `mem_inactive_anon`       | Inactive anonymous memory              |
| `mem_active_file`         | Active file-backed memory              |
| `mem_inactive_file`       | Inactive file-backed memory            |
| `mem_unevictable`         | Memory that cannot be reclaimed        |
| `mem_hierarchical_limit`  | Memory limit including children        |
| `mem_total_active_anon`   | Total active anonymous memory          |
| `mem_total_inactive_anon` | Total inactive anonymous memory        |
| `mem_total_active_file`   | Total active file-backed memory        |
| `mem_total_inactive_file` | Total inactive file-backed memory      |
| `mem_total_cache`         | Total page cache                       |
| `mem_total_rss`           | Total anonymous and swap cache         |
| `mem_total_rss_huge`      | Total resident huge pages              |
| `mem_total_mapped_file`   | Total size of memory-mapped files      |
| `mem_total_writeback`     | Total bytes being written back to disk |
| `mem_total_pgfault`       | Total page faults                      |
| `mem_total_pgmajfault`    | Total major page faults                |
| `mem_total_pgpgin`        | Total pages paged in                   |
| `mem_total_pgpgout`       | Total pages paged out                  |
| `mem_total_unevictable`   | Total memory that cannot be reclaimed  |

##### Network Metrics

| Field Name                | Description                       |
| ------------------------- | --------------------------------- |
| `net_in_bytes`            | Total bytes received              |
| `net_out_bytes`           | Total bytes transmitted           |
| `net_[iface]_in_bytes`    | Bytes received per interface      |
| `net_[iface]_out_bytes`   | Bytes transmitted per interface   |
| `net_[iface]_in_packets`  | Packets received per interface    |
| `net_[iface]_out_packets` | Packets transmitted per interface |
| `net_[iface]_in_errors`   | Receive errors per interface      |
| `net_[iface]_out_errors`  | Transmit errors per interface     |
| `net_[iface]_in_dropped`  | Packets dropped on receive        |
| `net_[iface]_out_dropped` | Packets dropped on transmit       |

##### Block I/O Metrics

| Field Name          | Description                 |
| ------------------- | --------------------------- |
| `blkio_read_bytes`  | Total bytes read from disk  |
| `blkio_write_bytes` | Total bytes written to disk |
| `blkio_sync_bytes`  | Synchronous I/O bytes       |
| `blkio_async_bytes` | Asynchronous I/O bytes      |
| `blkio_total_bytes` | Total I/O bytes             |

##### Process Metrics

| Field Name     | Description                         |
| -------------- | ----------------------------------- |
| `pids_current` | Current number of processes         |
| `pids_limit`   | Maximum number of processes allowed |
| `num_procs`    | Total number of processes           |

##### Timestamp Metrics

| Field Name     | Description                         |
| -------------- | ----------------------------------- |
| `read_time`    | Current stats collection timestamp  |
| `preread_time` | Previous stats collection timestamp |

> **Note**: When using `STATS_FIELDS="ESSENTIAL"`, only the following fields are collected:
>
> - `cpu_percent`
> - `mem_used`
> - `mem_total`
> - `net_in_bytes`
> - `net_out_bytes`

> **Performance Tip**: Collecting fewer fields reduces the storage requirements and processing overhead. Choose fields that are relevant to your monitoring needs.

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

| Variable        | Description                    | Default | Required |
| --------------- | ------------------------------ | ------- | -------- |
| `BATCH_SIZE`    | Maximum points per batch       | `100`   | No       |
| `BATCH_WAIT_MS` | Maximum wait time before flush | `2000`  | No       |

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
