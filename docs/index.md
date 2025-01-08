# Docker Stats Service Documentation

Welcome to the Docker Stats Service documentation. This guide will help you understand, use, and contribute to the service.

## Core Documentation

### Getting Started

- [Quick Start Guide](quickstart.md) - Get up and running in minutes
- [Installation Guide](installation.md) - Detailed installation steps
- [Basic Usage](usage.md) - Common usage scenarios

### Configuration

- [Environment Variables](configuration/environment-variables.md) - Available configuration options
- [Docker Setup](configuration/docker-setup.md) - Docker-specific configuration
- [Local Development](configuration/local-setup.md) - Setting up for local development

### Architecture

- [System Overview](architecture/overview.md) - High-level architecture
- [Component Design](architecture/components.md) - Detailed component descriptions
- [Data Flow](architecture/data-flow.md) - How data moves through the system

## User Guides

### Features

- [Metrics Collection](guides/metrics-collection.md) - How metrics are gathered
- [Stream Management](guides/stream-management.md) - Container stats streaming
- [Metrics Batching](guides/metrics-batching.md) - How metrics are processed
- [Custom Dashboards](guides/custom-dashboards.md) - Creating Grafana dashboards

### Operations

- [Deployment](guides/deployment.md) - Deployment guidelines
- [Monitoring](guides/monitoring.md) - Monitoring the service
- [Backup & Recovery](guides/backup-recovery.md) - Data management
- [Troubleshooting](guides/troubleshooting.md) - Common issues and solutions

## Developer Documentation

### Development

- [Contributing Guide](contributing.md) - How to contribute
- [Development Setup](development/setup.md) - Development environment setup
- [Code Structure](development/code-structure.md) - Codebase organization
- [Testing Guide](development/testing.md) - Testing practices

### Technical Reference

- [API Documentation](api/README.md) - API endpoints and usage
- [Error Handling](reference/error-handling.md) - Error types and recovery
- [Event System](reference/events.md) - Docker event handling
- [Metrics Schema](reference/metrics-schema.md) - Data structure

## Additional Resources

### Examples & Tutorials

- [Basic Usage Examples](examples/basic-usage.md)
- [Custom Dashboard Examples](examples/custom-dashboards.md)
- [Integration Examples](examples/integration.md)

### Reference

- [Changelog](../CHANGELOG.md) - Version history
- [FAQ](faq.md) - Frequently asked questions
- [Glossary](glossary.md) - Terms and definitions

### External Links

- [Docker Stats API](https://docs.docker.com/engine/api/v1.41/#operation/ContainerStats)
- [InfluxDB Docs](https://docs.influxdata.com/)
- [Grafana Docs](https://grafana.com/docs/)
- [Dockerode API](https://github.com/apocas/dockerode)
