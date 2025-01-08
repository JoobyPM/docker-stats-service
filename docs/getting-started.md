# Getting Started

This guide will help you set up and run the Docker Stats Service.

## Prerequisites

1. **Docker**

   - Docker Engine 20.10.0 or later
   - Docker Compose v2.0.0 or later
   - Docker socket accessible

2. **InfluxDB** (optional)
   - InfluxDB 1.X
   - Database created for metrics storage

## Installation

### Using Docker Compose

1. **Create docker-compose.yml**

   ```yaml
   version: '3.8'
   services:
     docker-stats:
       image: docker-stats-service
       environment:
         - INFLUXDB_HOST=influxdb
         - INFLUXDB_PORT=8086
         - INFLUXDB_DB=docker_stats
         - INFLUXDB_USER=admin
         - INFLUXDB_PASS=admin
       volumes:
         - /var/run/docker.sock:/var/run/docker.sock
       depends_on:
         - influxdb

     influxdb:
       image: influxdb:1.8
       ports:
         - '8086:8086'
       volumes:
         - influxdb_data:/var/lib/influxdb
       environment:
         - INFLUXDB_DB=docker_stats
         - INFLUXDB_ADMIN_USER=admin
         - INFLUXDB_ADMIN_PASSWORD=admin

   volumes:
     influxdb_data:
   ```

2. **Start Services**
   ```bash
   docker-compose up -d
   ```

## Verification

### Check Service Status

```bash
# Check container logs
docker-compose logs -f docker-stats

# Check service status
docker-compose ps
```

### Verify Metrics Collection

```bash
# Using influx CLI
influx -host localhost -port 8086 -database docker_stats -execute 'SELECT * FROM docker_stats_cpu WHERE time > now() - 5m'
```

## Common Issues

### Docker Socket Access

```bash
# Check socket permissions
ls -l /var/run/docker.sock

# Fix permissions if needed
sudo chmod 666 /var/run/docker.sock
```

### InfluxDB Connection

```bash
# Test InfluxDB connection
curl -I http://localhost:8086/ping

# Check database
influx -host localhost -port 8086 -execute 'SHOW DATABASES'
```

## Next Steps

1. **Configuration**

   - Review [Configuration Guide](configuration.md)
   - Adjust settings for your environment

2. **Monitoring**

   - Set up monitoring tools
   - Configure alerts

3. **Integration**
   - Add to existing stack
   - Configure logging

## Further Reading

- [Configuration Guide](configuration.md)
- [Stream Management](guides/stream.md)
- [Error Handling](reference/error-handling.md)
