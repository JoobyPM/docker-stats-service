# Docker Stats Service

A lightweight service that collects real-time Docker container metrics and stores them in InfluxDB. It automatically discovers containers, tracks their resource usage, and provides detailed metrics visualization through Grafana.

## Purpose & Use Case

This service is not intended to replace production-grade monitoring solutions like cAdvisor + Prometheus. Instead, it serves as a lightweight alternative specifically designed for development and testing scenarios.

The project emerged from a specific need: performing isolated performance testing of Docker containers with limited resources. While tools like cAdvisor + Prometheus are excellent for production monitoring, they presented limitations for this use case:

- Difficulty in getting precise CPU usage metrics for single containers with resource limits
- Sampling intervals averaging 2–5 seconds, which didn't correlate well with `docker stats` output
- Need for more granular, near real-time metrics during load testing

This service fills that gap by providing:

- High-precision resource utilization metrics via Docker's native streaming API
- Continuous, real-time metrics collection without polling delays
- Simplified setup for development environments
- Efficient multi-container monitoring

Perfect for:

- Load testing with resource-constrained containers
- Development environment monitoring
- Quick resource utilization analysis
- Scenarios require high-frequency sampling
- Real-time resource utilization analysis
- Scenarios requiring continuous monitoring

Key Advantages:

1. **Continuous Streaming**

   - Uses Docker's native stats streaming API
   - No artificial polling intervals or delays
   - Processes metrics as they become available
   - Direct correlation with Docker's internal stats

2. **Real-Time Processing**

   - Immediate metric processing as events arrive
   - No aggregation or sampling delays
   - Native backpressure handling
   - Efficient stream management

3. **Resource Efficiency**
   - Optimized for development environments
   - Minimal overhead compared to polling
   - Efficient batching for storage
   - Automatic scaling with container count

## Quick Start

```bash
# Clone the repository
git clone https://github.com/JoobyPM/docker-stats-service
cd docker-stats-service

# Start all services using Docker Compose
docker compose -f docker/docker-compose.yml up -d

# Access Grafana dashboard
open http://localhost:3009
# Login with admin/admin
```

## Features

- Real-time container metrics streaming
- Automatic discovery and monitoring of all containers
- Pre-configured Grafana dashboards (auto-provisioned from `docker/grafana_config/dashboards/`)
- Event-based container monitoring with automatic recovery
- Efficient InfluxDB storage with batching
- Configurable logging levels
- Support for both local and Docker environments
- Stream-based metrics collection with backpressure handling

## Prerequisites

- Docker 20.10.0 or higher
- Docker Compose v2.0.0 or higher
- Node.js 21+ (for local development)
- pnpm 8.0.0 or higher
- 256MB+ available memory
- Available ports: 3009 (Grafana), 8086 (InfluxDB)

## Runtime Environments

The service supports both local and Docker environments through the `DOCKER` environment variable:

### Local Environment (`DOCKER=false`)

- Default InfluxDB host: `localhost`
- Docker socket path: `/var/run/docker.sock`
- Direct access to host network

### Docker Environment (`DOCKER=true`)

- Default InfluxDB host: `host.docker.internal` (macOS/Windows) or `172.17.0.1` (Linux)
- Docker socket mounted as volume
- Container network configuration required

Note: On Linux hosts, you may need to use the Docker bridge network IP (`172.17.0.1`) or your host's actual IP instead of `host.docker.internal`.

## Environment Variables

| Variable                   | Description                                 | Default                | Required | Notes                                                                      |
| -------------------------- | ------------------------------------------- | ---------------------- | -------- | -------------------------------------------------------------------------- |
| `DOCKER`                   | Running in Docker environment               | `false`                | No       | Affects default InfluxDB host                                              |
| `LOG_LEVEL`                | Logging verbosity (debug,info,warn,error)   | `info`                 | No       |                                                                            |
| `INFLUXDB_HOST`            | InfluxDB host                               | See notes              | No       | Defaults to `host.docker.internal` if `DOCKER=true`, otherwise `localhost` |
| `INFLUXDB_PORT`            | InfluxDB port                               | `8086`                 | No       |                                                                            |
| `INFLUXDB_PROTOCOL`        | InfluxDB protocol                           | `http`                 | No       |                                                                            |
| `INFLUXDB_USER`            | InfluxDB username                           | `admin`                | No       |
| `INFLUXDB_PASS`            | InfluxDB password                           | `admin`                | No       |
| `INFLUXDB_DB`              | InfluxDB database name                      | `docker-stats`         | No       |
| `INFLUXDB_RETRY_MAX`       | Maximum number of retry attempts            | `5`                    | No       |
| `INFLUXDB_RETRY_DELAY`     | Initial retry delay in milliseconds         | `1000`                 | No       |
| `INFLUXDB_RETRY_MAX_DELAY` | Maximum retry delay in milliseconds         | `10000`                | No       |
| `SHUTDOWN_TIMEOUT_MS`      | Maximum time to wait for graceful shutdown  | `10000`                | No       |
| `BATCH_SIZE`               | Maximum number of points in a metrics batch | `100`                  | No       |
| `BATCH_WAIT_MS`            | Maximum time to wait before flushing batch  | `2000`                 | No       |
| `DOCKER_SOCKET_PATH`       | Path to Docker socket                       | `/var/run/docker.sock` | No       |
| `STATS_BUFFER_SIZE`        | Size of stats stream buffer in bytes        | `1048576`              | No       |
| `STATS_LINE_SIZE`          | Maximum size of a single stats line         | `102400`               | No       |
| `STATS_PARSE_TIMEOUT`      | Timeout for parsing stats in milliseconds   | `30000`                | No       |

### Metrics Batching

The service implements efficient metrics batching to optimize InfluxDB write performance:

1. **Batching Strategy**

   - Points are collected in memory until batch criteria are met
   - Batches are flushed when either:
     - Batch size reaches `BATCH_SIZE`
     - Time since last flush exceeds `BATCH_WAIT_MS`
     - Service is shutting down

2. **Performance Benefits**

   - Reduced network overhead
   - Fewer database write operations
   - Lower database load
   - Better throughput
   - Optimized resource usage

3. **Reliability Features**

   - Automatic retry on writing failures
   - Failed writes are re-queued
   - Exponential backoff between retries
   - Graceful handling of shutdown
   - Memory usage protection

4. **Batch Processing**

   ```
   [Container Stats] → [Memory Batch] → [InfluxDB Write]
                          ↑               ↓
                    [New Points]    [Success/Retry]
   ```

5. **Best Practices**
   - Adjust batch size based on container count
   - Monitor memory usage
   - Balance latency vs throughput
   - Consider network conditions
   - Monitor write performance

### Error Handling

The service implements comprehensive error handling with the following features:

1. **InfluxDB Operations**

   - Automatic retry for transient failures
   - Smart error classification (fatal vs. retryable)
   - Exponential backoff with jitter
   - Detailed error logging

2. **Fatal Errors** (no retry)

   - Authentication failures
   - Permission issues
   - Invalid database names
   - Database not found

3. **Retryable Errors** (with backoff)

   - Network timeouts
   - Connection refused
   - Socket hang ups
   - Connection resets

4. **Stream Handling**
   - Automatic cleanup of dead streams
   - Error recovery for Docker stats streams
   - JSON parsing error handling
   - Network error recovery

### Graceful Shutdown

The service implements a robust graceful shutdown mechanism that ensures:

1. **Clean Resource Release**

   - Proper closure of Docker stats streams
   - Graceful InfluxDB connection termination
   - Event stream cleanup

2. **Shutdown Triggers**

   - SIGTERM signal handling
   - SIGINT (Ctrl+C) handling
   - Uncaught exception handling
   - Unhandled rejection handling

3. **Shutdown Process**

   - Stop accepting new container watches
   - Completes in-flight metric writes
   - Closes active connections
   - Logs shutdown progress

4. **Timeout Protection**
   - Maximum shutdown wait time
   - Force exit if timeout exceeded
   - Individual handler timeouts

### Retry Mechanism

The service implements a robust retry mechanism for InfluxDB operations with the following features:

- Exponential backoff with jitter
- Configurable retry attempts and delays
- Smart error handling (no retries for authentication failures)
- Automatic retry for transient network issues
- Detailed logging of retry attempts

The retry mechanism applies to:

- Database initialization
- Metrics writing
- Connection health checks
- Database operations

## Health Checks

The service implements the following health checks:

1. Docker API connectivity
2. InfluxDB connection status
3. Metrics write capability
4. Event stream status

## Data Structure

### InfluxDB Schema

```
measurement: docker_stats
tags:
  - container_id: unique container identifier
  - container_name: human-readable container name
fields:
  - cpu_percent: CPU usage percentage
  - mem_used: Memory usage in bytes
  - mem_total: Total memory limit
  - net_in_bytes: Network bytes received
  - net_out_bytes: Network bytes transmitted
timestamp: measurement timestamp
```

### Grafana Dashboards

The service comes with pre-configured Grafana dashboards that are automatically provisioned during startup. The dashboards are stored in:

```
docker/ grafana_config/dashboards/
```

To customize or add new dashboards:

1. Add your JSON dashboard files to the `docker/ grafana_config/dashboards/` directory
2. Restart the Grafana container: `pnpm docker:restart grafana`

The default dashboard provides:

- CPU usage per container
- Memory usage per container
- Network I/O metrics
- Container lifecycle events

## Development

### Local Setup

```bash
# Install dependencies
pnpm install

# Run the service
pnpm start

# Run with debug logging
LOG_LEVEL=debug pnpm start

# Lint code
pnpm lint
pnpm lint:fix  # Auto-fix linting issues

# Format code
pnpm format
pnpm format:check  # Check formatting without fixing
```

### Docker Commands

```bash
# Start all services
pnpm docker:up

# Force rebuild and start
pnpm docker:up:force

# View logs
pnpm docker:logs

# Stop services
pnpm docker:down

# Build containers
pnpm docker:build

# Restart services
pnpm docker:restart

# Stop services (without removing)
pnpm docker:stop
```

## Troubleshooting

### Common Issues

1. **No Metrics Appearing**

   - Check Docker socket permissions: `ls -la /var/run/docker.sock`
   - Verify InfluxDB connection: `curl http://localhost:8086/health`
   - Check container logs: `docker logs docker-stats-service`

2. **High CPU Usage**

   - Reduce logging level: `LOG_LEVEL=warn`
   - Check container count: `docker ps | wc -l`
   - Monitor InfluxDB write performance

3. **Memory Issues**

   - Check available system memory: `free -m` (for linux users)
   - Monitor container memory limits
   - Verify InfluxDB memory usage
   - Consider enabling swap

4. **Network Connectivity**
   - Verify Docker network: `docker network ls`
   - Verify port mappings: `docker compose -f docker/docker-compose.yml ps`
   - Check network driver status

### Debug Mode

Enable debug logging for detailed information:

```bash
LOG_LEVEL=debug pnpm start
```

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow ESLint configuration
- Add tests for new features
- Update documentation
- Follow semantic versioning
- Add meaningful commit messages
- Write clear JSDoc comments
- Consider edge cases and error handling

### Code Organization

The codebase follows a clear directory structure:

1. **`src/services/`** - Core service implementations

   - `docker/` - Docker-related functionality
     - `events.mjs` - Container lifecycle event handling
     - `containers.mjs` - Container management and discovery
     - `stream-manager.mjs` - Stats stream handling
     - `stats-parser.mjs` - Raw stats processing
     - `validation.mjs` - Docker-specific validation
   - `metrics/` - Metrics processing and storage
     - `handler.mjs` - Metrics collection and batching
     - `transformer.mjs` - Metrics transformation logic

2. **`src/types/`** - Shared type definitions

   - `docker.mjs` - Docker-related type definitions
   - `config.mjs` - Configuration type definitions

3. **`src/utils/`** - Shared utilities

   - `batch.mjs` - Batching utilities
   - `common.mjs` - Common helper functions
   - `influx.mjs` - InfluxDB client utilities
   - `shutdown.mjs` - Graceful shutdown handling

4. **`src/config/`** - Configuration management
   - `config.mjs` - Application configuration

When contributing:

- Keep Docker-specific logic in `services/docker/`
- Place metrics handling code in `services/metrics/`
- Add shared types to `types/` directory
- Use utility functions from `utils/` where possible
- Follow existing module boundaries
- Document new types using JSDoc

## Modular Architecture

The codebase is organized into focused, maintainable modules that separate concerns by responsibility.
This modular approach replaces the original monolithic design,
making the codebase more maintainable and easier to understand.

### Core Services

1. **Docker Service** (`services/docker/`)
   - **Event Monitor** (`events.mjs`)
     - Listens to Docker container lifecycle events
     - Forwards events to Container Watcher
     - Provides event logging and error handling
   - **Container Manager** (`containers.mjs`)
     - Handles container discovery and metadata
     - Maintains container state
     - Manages container lifecycle
     - Coordinates with Stream Manager
   - **Stream Manager** (`stream-manager.mjs`)
     - Manages Docker stats streams
     - Implements stream pooling and cleanup
     - Handles backpressure and reconnection
     - Ensures proper stream lifecycle
   - **Stats Parser** (`stats-parser.mjs`)
     - Processes raw Docker stats
     - Handles data normalization
     - Validates stats format
   - **Validation** (`validation.mjs`)
     - Validates container operations
     - Ensures data integrity
     - Checks stats format

### Shared Components

1. **Types** (`types/`)

   - Centralized type definitions
   - Shared interfaces
   - Configuration types

2. **Utilities** (`utils/`)
   - Batching utilities
   - Common helpers
   - InfluxDB client
   - Shutdown management

### Benefits of Current Architecture

1. **Clear Separation of Concerns**

   - Docker events isolated from state management
   - Stream handling separated from stats processing
   - Clear interfaces between components
   - Easy to locate specific functionality

2. **Improved Maintainability**

   - Modules can be modified independently
   - Reduced coupling between components
   - Easier to understand and debug
   - Better code organization

3. **Better Testing Strategy**

   - Modules can be tested in isolation
   - Clear boundaries for integration tests
   - Easier to mock dependencies
   - Better test coverage

4. **Resource Management**
   - Efficient stream-based collection
   - Native Docker stats streaming
   - Proper stream cleanup
   - Memory leak prevention

### Development Guidelines

- Follow ESLint configuration
- Add tests for new features
- Update documentation
- Follow semantic versioning
- Add meaningful commit messages
- Write clear JSDoc comments
- Consider edge cases and error handling

### Runtime Environments

The service supports both local and Docker environments through the `DOCKER` environment variable:

### Local Environment (`DOCKER=false`)

- Default InfluxDB host: `localhost`
- Docker socket path: `/var/run/docker.sock`
- Direct access to host network

### Docker Environment (`DOCKER=true`)

- Default InfluxDB host: `host.docker.internal` (macOS/Windows) or `172.17.0.1` (Linux)
- Docker socket mounted as volume
- Container network configuration required

Note: On Linux hosts, you may need to use the Docker bridge network IP (`172.17.0.1`) or your host's actual IP instead of `host.docker.internal`.

### Metrics Collection

The service uses Docker's streaming stats API to collect metrics in real-time:

1. **Container Discovery**

   - Automatically discovers running containers
   - Monitors new container starts
   - Handles container stops and removals

2. **Continuous Streaming**

   - Uses Docker's native stats streaming API
   - One stream per monitored container
   - Automatic stream recovery on errors
   - Built-in backpressure handling

3. **Stream Management**

   - Maintains stream lifecycle
   - Handles connection errors
   - Manages concurrent streams
   - Ensures proper cleanup

4. **Data Processing**
   - Validates raw stats format
   - Transforms metrics for storage
   - Implements efficient batching
   - Handles write retries

This approach provides:

- Real-time metrics via native streaming
- Efficient resource usage
- Reliable data collection
- Clean stream management

## Architecture

The service follows a modular architecture designed for reliability and performance. Below are the key architectural diagrams:

### System Overview

![System Overview](docs/architecture/diagrams/overview.svg)

The system consists of three main parts:

1. Docker Host - Where containers run and metrics are collected
2. Storage & Visualization - Where metrics are stored and displayed
3. User Interface - Where metrics are viewed and analyzed

### Component Architecture

[Component Architecture](docs/architecture/diagrams/components.puml)

Key components:

1. **Event Monitor** - Watches Docker events for container lifecycle changes
2. **Stats Collector** - Collects and processes container metrics
3. **Metrics Batcher** - Batches metrics for efficient storage
4. **Retry Handler** - Manages retries for failed operations
5. **Shutdown Manager** - Ensures graceful service shutdown
6. **Utilities** - Error handling and logging components

### Metrics Collection Flow

[Metrics Flow](docs/architecture/diagrams/metrics_flow.puml)

The metrics collection process:

1. Container start triggers stats collection
2. Docker stats stream is opened for continuous collection
3. Points are batched for efficient writing
4. Batches are written with retry support
5. Container stop ends collection
6. Shutdown ensures no data loss

## License

[MIT License](https://opensource.org/licenses/MIT)

See the [LICENSE](./LICENSE.md) file for details.

## Acknowledgments

- Docker Engine API
- InfluxDB Team
- Grafana Labs
- dockerode

## Documentation

### Guides

The following guides are available in the [docs/guides](docs/guides) directory:

- [Testing Guide](docs/guides/testing.md) - Detailed information about testing practices and procedures
- [Docker Container Stats Explained](docs/guides/docker-stats-and-dockerode-guide.md) - Small Guide to Dockerode & Docker Stats

### JSDoc Documentation

The codebase is thoroughly documented using JSDoc comments. This provides:

- Type definitions for key interfaces and configurations
- Detailed function documentation with parameters and return types
- Usage examples for major utilities
- Clear documentation of error handling and edge cases

To generate documentation from JSDoc comments:

1. Generate documentation:

```bash
pnpm run jsdoc
```

The generated documentation will be available in the `docs/api` directory.

### Architecture Diagrams

The `docs/architecture` directory contains PlantUML diagrams that visualize:

- High-level system architecture (`overview.puml`)
- Internal component structure (`components.puml`)
- Metrics collection flow (`metrics_flow.puml`)

## Docker Socket & Permissions

This service requires access to the Docker socket (`/var/run/docker.sock`) to collect container statistics. Common permission issues can prevent the service from reading container stats.

### Socket Configuration

1. The socket must be mounted in your container:

   ```yaml
   volumes:
     - /var/run/docker.sock:/var/run/docker.sock
   ```

2. Ensure proper socket permissions on the host:

   ```bash
   # Check current permissions
   ls -l /var/run/docker.sock

   # Fix permissions if needed (common solution)
   sudo chmod 666 /var/run/docker.sock
   ```

3. Group membership (alternative to chmod):
   ```bash
   # Add your user to the docker group
   sudo usermod -aG docker $USER
   ```

### Common Permission Issues

- **No stats showing up**: First check if the service can access the Docker socket
- **Permission denied errors**: Verify socket permissions and group membership
- **Socket not found**: Ensure Docker is running and the socket is mounted correctly

## Documentation

### JSDoc Documentation

The codebase is extensively documented using JSDoc comments. This includes:

- Negative-space programming checks
- Retry mechanisms and error handling
- Configuration options and environment variables
- Type definitions and interfaces

Generate the documentation:

```bash
pnpm run jsdoc
```

The generated documentation will be available in the `docs` directory.

### Documentation Maintenance

When modifying the codebase:

1. Keep JSDoc comments up to date with code changes
2. Update type definitions if interfaces change
3. Ensure `jsdoc.config.json` references remain valid if files are moved
4. Run `pnpm run jsdoc` to verify documentation builds correctly

## Metrics Collection

The service uses Docker's streaming stats API to collect metrics in real-time:

1. **Container Discovery**

   - Automatically discovers all running containers
   - Monitors new containers as they start
   - Cleans up monitoring when containers stop

2. **Continuous Streaming**

   - Opens persistent stats stream per container
   - Processes stats events as they arrive
   - Implements backpressure handling
   - Provides automatic stream recovery

3. **Stream Management**

   - Maintains stream lifecycle
   - Handles stream errors and reconnection
   - Manages concurrent container streams
   - Ensures proper stream cleanup

4. **Efficient Processing**
   - Batches metrics for optimal storage
   - Validates and transforms raw stats
   - Processes stats in real-time
   - Scales with container count

This approach provides:

- Native Docker stats streaming
- Minimal collection latency
- Better resource utilization
- Automatic scaling with container count
