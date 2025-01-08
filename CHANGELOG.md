# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-01-08

### Added

- Initial release
- Real-time Docker container stats collection
- Automatic container discovery and monitoring
- InfluxDB 1.X integration for metrics storage
- Stream-based stats collection with automatic recovery
- Efficient metrics batching and buffering
- Docker Compose deployment support
- Comprehensive error handling and logging
- Environment-based configuration
- Docker socket integration via Dockerode
- Memory-efficient stream management
- Automatic retry mechanisms for resilience
- Debug mode for troubleshooting

### Dependencies

- Node.js >=21.0.0
- Docker Engine >=20.10.0
- InfluxDB 1.X
- dockerode ^4.0.3
- influx ^5.9.3
