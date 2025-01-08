# Architecture Overview

The Docker Stats Service follows a modular architecture designed for reliability and efficient metrics collection.

## System Components

![System Overview](diagrams/overview.svg)

### Core Components

1. **Event Monitor** (`events.mjs`)

   - Listens to Docker container lifecycle events
   - Forwards events to Container Watcher
   - Provides basic event logging

2. **Container Watcher** (`containers.mjs`)

   - Maintains container state
   - Coordinates container monitoring
   - Manages stream creation/removal
   - Handles container discovery

3. **Stream Manager** (`stream-manager.mjs`)

   - Creates and manages stats streams
   - Handles stream errors and cleanup
   - Implements backpressure handling
   - Ensures proper stream lifecycle

4. **Stats Parser** (`stats-parser.mjs`)

   - Processes raw Docker stats
   - Handles data normalization
   - Validates stats format

5. **Metrics Handler** (`metrics/handler.mjs`)
   - Batches metrics for storage
   - Manages InfluxDB writes
   - Implements retry logic

## Data Flow

![Metrics Flow](diagrams/metrics_flow.puml)

### Collection Process

1. **Container Discovery**

   ```
   Docker Event → Event Monitor → Container Watcher → Stream Creation
   ```

2. **Stats Collection**

   ```
   Docker Stats Stream → Stream Manager → Stats Parser → Metrics Handler
   ```

3. **Storage Flow**
   ```
   Metrics Handler → Batch Processing → InfluxDB Write
   ```

## Component Interactions

![Component Architecture](diagrams/components.puml)

### Key Interactions

1. **Event Handling**

   - Docker events trigger container monitoring
   - Container Watcher manages stream lifecycle
   - Clean shutdown on container stop

2. **Stream Management**

   - One stream per container
   - Automatic recovery on errors
   - Proper resource cleanup

3. **Data Processing**
   - Continuous stats streaming
   - Efficient batch processing
   - Reliable storage

## Design Principles

### 1. Modularity

- Clear separation of concerns
- Independent components
- Well-defined interfaces
- Easy to test and maintain

### 2. Reliability

- Automatic error recovery
- Proper resource cleanup
- Graceful degradation
- Robust error handling

### 3. Efficiency

- Native Docker streaming
- Smart batching
- Resource management
- Minimal overhead

## Implementation Details

### Stream States

```
[Container Start] → STARTING → ACTIVE → STOPPING → STOPPED
       ↑              ↓         ↓
       └──────────────┴─────────┘
        (Auto-retry on error)
```

### Batch Processing

```
[Container Stats] → [Memory Batch] → [InfluxDB Write]
        ↑               ↓
  [New Points]    [Success/Retry]
```

## Code Organization

```
src/
├── services/
│   ├── docker/          # Docker interaction
│   │   ├── events.mjs
│   │   ├── containers.mjs
│   │   ├── stream-manager.mjs
│   │   ├── stats-parser.mjs
│   │   └── validation.mjs
│   └── metrics/         # Metrics handling
│       ├── handler.mjs
│       └── transformer.mjs
├── utils/              # Shared utilities
├── types/              # Type definitions
└── config/             # Configuration
```

## Further Reading

- [Component Details](components.md)
- [Data Flow Details](data-flow.md)
- [Error Handling](../reference/error-handling.md)
- [Metrics Schema](../reference/metrics-schema.md)
