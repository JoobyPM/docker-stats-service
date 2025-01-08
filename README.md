# Docker Stats Service

A lightweight service for real-time Docker container metrics collection and storage in InfluxDB, optimized for development and testing environments.

## Key Features

- **Real-Time Metrics**: Continuous streaming of container stats via Docker's native API
- **Automatic Discovery**: Dynamic container detection and monitoring
- **Development Focused**: Optimized for local environments and testing scenarios
- **Pre-Configured Visualization**: Ready-to-use Grafana dashboards
- **Efficient Processing**: Smart batching and stream management
- **Simple Integration**: Works with both local and Docker environments

[📚 Read the full documentation](docs/index.md)

## Quick Start

```bash
# Clone and enter the repository
git clone https://github.com/JoobyPM/docker-stats-service
cd docker-stats-service

# Start all services
docker compose -f docker/docker-compose.yml up -d

# Access Grafana dashboard
open http://localhost:3009  # Login with admin/admin
```

## Prerequisites

- Docker 20.10.0+
- Docker Compose v2.0.0+
- Available ports: 3009 (Grafana), 8086 (InfluxDB)

For local development:

- Node.js 21+
- pnpm 8.0.0+

## Basic Usage

1. **View Metrics**

   - Access Grafana at `http://localhost:3009`
   - Use the pre-configured dashboards
   - Monitor container CPU, memory, and network stats

2. **Custom Dashboards**

   - Add dashboards to `docker/grafana_config/dashboards/`
   - Restart Grafana: `pnpm docker:restart grafana`

3. **Development**

   ```bash
   # Local development
   pnpm install
   pnpm start

   # With debug logging
   LOG_LEVEL=debug pnpm start
   ```

## Documentation

- [Getting Started Guide](docs/getting-started.md)
- [Configuration Guide](docs/configuration.md)
- [Architecture Overview](docs/architecture/README.md)
- [Troubleshooting Guide](docs/troubleshooting.md)
- [API Documentation](docs/api/README.md)

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

See our [Contributing Guide](docs/contributing.md) for detailed guidelines.

## License

[MIT License](LICENSE.md)

## Acknowledgments

- Docker Engine API
- InfluxDB Team
- Grafana Labs
- dockerode
