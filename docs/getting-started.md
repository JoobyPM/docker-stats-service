# Getting Started with Docker Stats Service

This guide will help you get the Docker Stats Service up and running quickly.

## Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/JoobyPM/docker-stats-service
   cd docker-stats-service
   ```

2. **Check Prerequisites**

   - Docker 20.10.0 or higher
   - Docker Compose v2.0.0 or higher
   - Available ports: 3009 (Grafana), 8086 (InfluxDB)

3. **Start the Service**
   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```

## Initial Setup

1. **Access Grafana**

   - Open `http://localhost:3009` in your browser
   - Login with default credentials:
     - Username: `admin`
     - Password: `admin`
   - You'll be prompted to change the password on first login

2. **Verify Installation**
   - Check service status:
     ```bash
     docker compose -f docker/docker-compose.yml ps
     ```
   - View service logs:
     ```bash
     docker compose -f docker/docker-compose.yml logs -f
     ```

## Basic Configuration

### Environment Variables

The service uses these default values:

```bash
DOCKER=false               # Set to true if running in Docker
LOG_LEVEL=info            # Logging level (debug, info, warn, error)
INFLUXDB_HOST=localhost   # InfluxDB host address
INFLUXDB_PORT=8086        # InfluxDB port
```

See the [Configuration Guide](configuration.md) for all options.

## First Steps

1. **View Container Metrics**

   - Navigate to Grafana
   - Open the "Container Overview" dashboard
   - You should see metrics for all running containers

2. **Start Monitoring New Containers**

   ```bash
   # Start a test container
   docker run -d --name test-container nginx

   # View its metrics in Grafana
   # The container will be automatically detected
   ```

3. **Check Container Stats**
   - CPU usage
   - Memory consumption
   - Network I/O
   - Container events

## Next Steps

- Read the [Configuration Guide](configuration.md) for customization options
- Learn about [Custom Dashboards](guides/custom-dashboards.md)
- Check [Troubleshooting](troubleshooting.md) if you encounter issues
- Explore [Advanced Features](guides/metrics-collection.md)

## Common Issues

1. **No Metrics Showing**

   - Verify Docker socket permissions
   - Check if InfluxDB is running
   - Ensure containers are running

2. **Cannot Access Grafana**

   - Verify port 3009 is available
   - Check if Grafana container is running
   - Review service logs

3. **Linux Users**
   - If using Docker mode, set `INFLUXDB_HOST` to your host's Docker bridge IP
   - Default `host.docker.internal` doesn't work on Linux

## Getting Help

- Check the [FAQ](faq.md)
- Review [Troubleshooting Guide](troubleshooting.md)
- Open an issue on GitHub
