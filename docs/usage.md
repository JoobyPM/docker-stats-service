# Basic Usage Guide

This guide covers common usage scenarios for the Docker Stats Service.

## Monitoring Containers

### View All Containers

1. Access Grafana Dashboard

   ```bash
   open http://localhost:3009
   ```

   - Login with your credentials
   - Select the "Container Overview" dashboard

2. Available Metrics
   - CPU Usage
   - Memory Consumption
   - Network I/O
   - Container Events

### Monitor Specific Containers

The service automatically detects and monitors all running containers. To monitor specific containers:

```bash
# Start a test container
docker run -d --name test-nginx nginx

# Start another container
docker run -d --name test-redis redis

# View their metrics in Grafana
# They will appear automatically in the dashboard
```

## Working with Dashboards

### Default Dashboards

1. **Container Overview**

   - Real-time CPU and memory usage
   - Network traffic graphs
   - Container status indicators

2. **Detailed Metrics**
   - Per-container detailed stats
   - Historical data views
   - Resource usage trends

### Custom Dashboards

1. Create New Dashboard

   - Click "+" in Grafana
   - Select "Dashboard"
   - Choose visualization type

2. Add Custom Panels

   - Select metrics from InfluxDB
   - Configure display options
   - Set refresh intervals

3. Save Custom Dashboards

   ```bash
   # Export dashboard to JSON
   cp your-dashboard.json docker/grafana_config/dashboards/

   # Restart Grafana to load new dashboard
   pnpm docker:restart grafana
   ```

## Common Operations

### Check Service Status

```bash
# View service status
docker compose -f docker/docker-compose.yml ps

# Check service logs
docker compose -f docker/docker-compose.yml logs -f
```

### Debug Mode

Enable detailed logging:

```bash
# Start with debug logging
LOG_LEVEL=debug pnpm start

# Or set in docker-compose.yml
environment:
  - LOG_LEVEL=debug
```

### Resource Management

Monitor service resource usage:

```bash
# Check container resource usage
docker stats docker-stats-service

# Monitor InfluxDB size
du -sh /path/to/influxdb/data
```

## Integration Examples

### Custom Metrics Collection

```bash
# Start container with specific resource limits
docker run -d \
  --name limited-nginx \
  --cpus 0.5 \
  --memory 512m \
  nginx

# Monitor in dashboard
# Resource limits will be reflected in metrics
```

### Batch Operations

```bash
# Start multiple containers
for i in {1..3}; do
  docker run -d --name "test-$i" nginx
done

# All containers will be automatically monitored
```

## Next Steps

- [Configuration Guide](configuration.md) - Customize service settings
- [Troubleshooting](troubleshooting.md) - Solve common issues
