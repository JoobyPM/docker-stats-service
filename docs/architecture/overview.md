# Architecture Overview

This document provides a high-level explanation of the architecture and data flow for the Docker Stats Service, bridging the gap between UML diagrams and the implementation code.

---

## High-Level Data Flow

1. **Docker Events** → 2. **Container Watcher & Stream Manager** → 3. **Metrics Handler & Batcher** → 4. **InfluxDB**

### 1. Docker Events

- Docker's native event streaming API provides real-time notifications about container lifecycle events such as `start` and `stop`. The handling ensures coverage of common and edge cases, including scenarios like rapid restarts, duplicate events, and unexpected termination.
- The `Event Monitor` (located in `src/services/docker/events.mjs`) listens for these events and orchestrates updates to the `Container Watcher`.

### 2. Container Watcher & Stream Manager

- The `Container Watcher` (`src/services/docker/containers.mjs`) manages container discovery and monitoring.
  - For each active container, it initializes a stats stream.
- The `Stream Manager` (`src/services/docker/stream-manager.mjs`) handles the concurrency and lifecycle of these stats streams, ensuring efficient management and cleanup.
  - Handles backpressure, streaming errors, and reconnections.

### 3. Metrics Handler & Batcher

- The `Metrics Handler` (`src/services/metrics/handler.mjs`) processes parsed container metrics (e.g., CPU, memory, network) from the stats streams.
- Metrics are batched using an optimized mechanism (`src/utils/batch.mjs`) to minimize write operations to InfluxDB while maintaining real-time responsiveness. Error handling and retry mechanisms ensure data integrity and minimize data loss during transient failures.

### 4. InfluxDB

- Parsed metrics are transformed using logic from `src/services/metrics/transformer.mjs` to ensure proper formatting and structure, then batched and stored in an InfluxDB database.
- Each data point includes fields like `cpu_percent` and `mem_used`, and tags for container identification (e.g., `container_id`, `container_name`).

---

## Key Components and Modular Structure

### Docker Event Monitoring

- **Purpose:** Detect container lifecycle events.
- **Code Reference:** `src/services/docker/events.mjs`
- **Interaction:** Triggers the `Container Watcher` to start or stop monitoring containers.

### Container Monitoring

- **Purpose:** Track stats streams for active containers.
- **Code Reference:** `src/services/docker/containers.mjs`
- **Interaction:** Uses the `Stream Manager` to manage streams.

### Stream Management

- **Purpose:** Efficiently handle and validate raw stats streams, ensuring memory and CPU constraints are managed through stream prioritization, adaptive buffering, and error-handling strategies as implemented in `src/services/docker/stream-manager.mjs`.
- **Code Reference:** `src/services/docker/stream-manager.mjs`
- **Interaction:** Streams parsed data to the `Metrics Handler` for processing.

### Metrics Processing

- **Purpose:** Transform raw stats into structured data points for InfluxDB.
- **Code Reference:** `src/services/metrics/handler.mjs`
- **Interaction:** Uses batching (`src/utils/batch.mjs`) to optimize database writes.

---

## Concurrency and Resilience

### Stream Manager as a Concurrency Solution

The `Stream Manager` is a newly introduced modular service that manages multiple concurrent stats streams efficiently. It implements specific mechanisms for stream prioritization and error recovery, ensuring robust performance and resilience.

- The `Stream Manager` is a newly introduced modular service that manages multiple concurrent stats streams efficiently.
- It ensures:
  - Streams do not overwhelm memory or CPU.
  - Graceful handling of errors, backpressure, and reconnection.

---

## Modular Architecture Benefits

1. **Scalability:** Components like the `Stream Manager` and `Metrics Handler` operate independently, enabling horizontal scaling.
2. **Error Isolation:** Issues in one container’s stats stream do not affect the entire service.
3. **Reusability:** The batching utility (`src/utils/batch.mjs`) and retryable InfluxDB client (`src/utils/influx.mjs`) can be reused across different modules.

---

## Links to Code Modules

| Module            | File Path                                |
| ----------------- | ---------------------------------------- |
| Event Monitor     | `src/services/docker/events.mjs`         |
| Container Watcher | `src/services/docker/containers.mjs`     |
| Stream Manager    | `src/services/docker/stream-manager.mjs` |
| Metrics Handler   | `src/services/metrics/handler.mjs`       |
| Batch Utility     | `src/utils/batch.mjs`                    |

---

This overview ties the architectural components together, emphasizing modularity, concurrency, and efficient data flow. The design ensures that the service is reliable and scalable for real-time Docker container metrics monitoring.
