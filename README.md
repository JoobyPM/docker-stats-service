# Docker Stats Service

A lightweight service that collects real-time Docker container metrics and stores them in InfluxDB. It automatically discovers containers, tracks their resource usage, and provides detailed metrics visualization through Grafana.

## Overview

This service provides real-time Docker container monitoring for development and testing environments. It uses Docker's native stats streaming API to collect metrics continuously and efficiently.

Key benefits:

- Real-time metrics via Docker's native streaming API
- Automatic container discovery and monitoring
- Simple setup for development environments
- Pre-configured Grafana dashboards

[📚 Read the full documentation](docs/index.md)

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

## Prerequisites

- Docker 20.10.0 or higher
- Docker Compose v2.0.0 or higher
- Node.js 21+ (for local development)
- pnpm 8.0.0 or higher
- Available ports: 3009 (Grafana), 8086 (InfluxDB)

## Features

- Real-time container metrics streaming
- Automatic container discovery
- Pre-configured Grafana dashboards
- Event-based monitoring with recovery
- Efficient metrics batching
- Support for local and Docker environments

## Documentation

- [Getting Started Guide](docs/getting-started.md)
- [Configuration Guide](docs/configuration.md)
- [Architecture Overview](docs/architecture/README.md)
- [API Documentation](docs/api/README.md)
- [Development Guide](docs/development.md)
- [Troubleshooting Guide](docs/troubleshooting.md)

## Development

```bash
# Install dependencies
pnpm install

# Run locally
pnpm start

# Run with debug logging
LOG_LEVEL=debug pnpm start

# Development commands
pnpm lint        # Check code style
pnpm lint:fix    # Fix code style
pnpm format      # Format code
pnpm test        # Run tests
```

## Docker Commands

```bash
# Start services
pnpm docker:up

# View logs
pnpm docker:logs

# Stop services
pnpm docker:down
```

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

See our [Contributing Guide](docs/contributing.md) for more details.

## License

[MIT License](LICENSE.md)

## Acknowledgments

- Docker Engine API
- InfluxDB Team
- Grafana Labs
- dockerode
