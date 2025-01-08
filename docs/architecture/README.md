# Architecture Overview

This document provides a comprehensive overview of the Docker Stats Service architecture.

## High-Level Data Flow

1. **Docker Events** → 2. **Container Watcher & Stream Manager** → 3. **Metrics Handler & Batcher** → 4. **InfluxDB**

### 1. Docker Events

- Docker's native event streaming API provides real-time notifications about container lifecycle events such as `start` and `stop`
- The `Event Monitor` (located in `src/services/docker/events.mjs`) listens for these events and orchestrates updates to the `Container Watcher`
- Handles common and edge cases, including scenarios like rapid restarts, duplicate events, and unexpected termination

### 2. Container Watcher & Stream Manager

- The `Container Watcher` (`src/services/docker/containers.mjs`) manages container discovery and monitoring
  - For each active container, it initializes a stats stream
- The `Stream Manager` (`src/services/docker/stream-manager.mjs`) handles the concurrency and lifecycle of these stats streams
  - Handles backpressure, streaming errors, and reconnections

### 3. Metrics Handler & Batcher

- The `Metrics Handler` (`src/services/metrics/handler.mjs`) processes parsed container metrics (CPU, memory, network)
- Metrics are batched using an optimized mechanism to minimize write operations while maintaining real-time responsiveness
- Error handling and retry mechanisms ensure data integrity during transient failures

### 4. InfluxDB

- Parsed metrics are transformed to ensure proper formatting and structure
- Each data point includes fields like `cpu_percent` and `mem_used`, and tags for container identification

## System Components

### Core Components

1. **Event Monitor**

   - Listens for Docker events
   - Detects container lifecycle changes
   - Forwards events to Container Watcher

2. **Container Watcher**

   - Manages container monitoring
   - Coordinates with Stream Manager
   - Handles container state

3. **Stream Manager**

   - Creates and manages stats streams
   - Handles stream lifecycle
   - Implements error recovery

4. **Stats Parser**

   - Processes raw stats data
   - Validates JSON format
   - Transforms metrics

5. **Metrics Handler**
   - Batches metrics
   - Manages InfluxDB writes
   - Handles backpressure

## Data Flow Diagram

```
                   ┌─────────────┐
                   │  Docker API │
                   └─────────────┘
                         │
                         ▼
┌─────────────┐   ┌─────────────┐
│    Event    │──▶│  Container  │
│   Monitor   │   │   Watcher   │
└─────────────┘   └─────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │   Stream    │
                  │   Manager   │
                  └─────────────┘
                         │
                         ▼
┌─────────────┐   ┌─────────────┐
│    Stats    │◀──│    Stats    │
│   Parser    │   │   Stream    │
└─────────────┘   └─────────────┘
       │
       ▼
┌─────────────┐
│   Metrics   │
│   Handler   │
└─────────────┘
       │
       ▼
┌─────────────┐
│  InfluxDB   │
└─────────────┘
```

## Module Organization

### Service Structure

```
src/
├── services/
│   ├── docker/
│   │   ├── events.mjs
│   │   ├── containers.mjs
│   │   ├── stream-manager.mjs
│   │   ├── stats-parser.mjs
│   │   └── validation.mjs
│   └── metrics/
│       └── handler.mjs
├── types/
│   └── index.jsdoc.mjs
├── config/
│   └── index.mjs
└── utils/
    └── index.mjs
```

## Design Patterns

### Event-Driven Architecture

1. **Event Handling**

   - Asynchronous processing
   - Event propagation
   - State management

2. **Stream Processing**
   - Reactive streams
   - Backpressure handling
   - Error recovery

### Modular Design

1. **Service Separation**

   - Clear boundaries
   - Single responsibility
   - Loose coupling

2. **Component Isolation**
   - Independent scaling
   - Focused testing
   - Easy maintenance

## Error Handling

### Recovery Strategies

1. **Stream Errors**

   - Automatic retry
   - Graceful degradation
   - State recovery

2. **Storage Errors**
   - Write retries
   - Batch recovery
   - Data integrity

## Performance

### Optimization Strategies

1. **Resource Management**

   - Memory efficiency
   - Connection pooling
   - Stream buffering

2. **Batch Processing**
   - Efficient writes
   - Optimal batch size
   - Write scheduling

## Security

### Access Control

1. **Docker Socket**

   - Minimal permissions
   - Secure mounting
   - Access validation

2. **InfluxDB**
   - Token authentication
   - Secure storage
   - Connection encryption

## Further Reading

- [Stream Management](../guides/stream.md)
- [Configuration](../configuration.md)
- [Troubleshooting](../troubleshooting.md)
