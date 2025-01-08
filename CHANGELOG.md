# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-01-08

### Added

- **Selective Field Recording**  
  Introduced a new environment variable `STATS_FIELDS` for controlling which stats fields are collected and stored.

  - **Empty** (default) → collects **all** fields
  - **`ESSENTIAL`** → collects a minimal, core set of CPU, memory, and network fields
  - **Comma-separated list** → collects only those specified fields (e.g. `cpu_percent,mem_used,pids_current`)  
    Log messages now alert if any requested fields do not exist in the actual Docker stats payload.

- **Expanded Metrics Extraction**
  - Additional fields extracted from Docker stats (e.g. block I/O, PID stats, per-CPU usage, and timestamps).
  - Enhanced memory stats (RSS, page faults, inactive pages, etc.).
  - Support for capturing `read_time` and `preread_time` as UNIX timestamps.

### Changed

- **Documentation**

  - Updated `README.md` to include examples and instructions for using the new `STATS_FIELDS` feature.
  - Added more detailed “Available Metrics” tables in `docs/configuration.md` for quick reference.

- **Internal Refactoring**
  - Consolidated logic for filtering fields into a single, easily maintainable function.
  - Enhanced logging around missing or undefined fields.

### Fixed

- Resolved minor logging inconsistencies for Docker events and container restarts.

---

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
