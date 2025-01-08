# `DRAFT` Concept of Testing Strategy

## 1. Architecture Alignment

Refer to the [Architecture Overview](../architecture/README.md), which outlines these components:

1. **Docker Events** → 2. **Container Watcher & Stream Manager** → 3. **Metrics Handler & Batcher** → 4. **InfluxDB**

**Testing** should exercise each layer:

- **Docker Events** & **Container Watcher**: E2E or Integration to confirm we detect container starts/stops and spin up streams.
- **Stream Manager** & **Stats Parser**: Deterministic Simulation tests can ensure we parse stats under various conditions.
- **Metrics Handler & Batcher**: Unit and Integration tests to validate our buffering, retries, etc.
- **InfluxDB**: Integration/E2E to confirm real DB writes.

---

## 2. Revised Testing Layers & Priorities

Below is a recommended multi-layer approach that includes a **basic E2E** early on, plus a separate **Deterministic Simulation** (DST) suite.

1. **Basic E2E Tests** (High Priority)

   - **Goal**: Quickly verify the entire pipeline (Docker Stats Service + a minimal container + Influx) so devs don’t rely on _manual_ checks.
   - **Scope**: Spin up a minimal environment (e.g. Docker Stats Service + ephemeral Influx + 1 test container).
   - **Outcome**: Confirm a container starts, stats are collected, points land in Influx.
   - **Why First**: Allows immediate confidence in the main flow—no manual steps required to ensure “it basically works.”

2. **Unit Tests** (High Priority)

   - **Goal**: Quickly validate pure JS logic (e.g., batch logic, error handling).
   - **Scope**: Offline tests for modules like `batch.mjs`, `shutdown.mjs`, `influx.mjs`.
   - **Outcome**: Quick feedback on logic bugs without Docker overhead.

3. **Integration Tests** (Medium Priority)

   - **Goal**: Confirm interactions with real Docker or real Influx in a narrower scope.
   - **Scope**:
     - **Partial Mocks**: Mock Docker, use real Influx container OR mock Influx, use real Docker.
     - **Full Integration**: Real Docker + real Influx, but with only a small test container (like `busybox`).
   - **Outcome**: Validate network calls, config, connection handling.

4. **Deterministic Simulation Testing (DST)** (Medium Priority)

   - **Goal**: Provide stable, repeatable tests that feed “fake Docker stats” into the system, avoiding real-time metric fluctuations.
   - **Scope**:
     - Replace calls to `docker.getContainer(...).stats()` with a “mocked” or “fake” stats server.
     - Supply pre-recorded or scripted stats frames (e.g., CPU = 150%, missing fields, corrupt JSON).
   - **Outcome**: Thorough coverage of corner cases, no flakiness from real Docker.

5. **Advanced/Full E2E** (Optional for Every Commit; Good for CI/CD Gate)
   - **Goal**: Spin up the complete environment (Docker Stats Service, InfluxDB, Grafana, plus multiple test containers).
   - **Scope**:
     - Confirm everything from container lifecycle → stats → Influx → Grafana UI.
   - **Outcome**: Ensures real-world usage is correct, including dashboards.
   - **Why**: Generally slower; can be run on merges to `main` or nightly.

---

## 3. Detailed Task Breakdown

### A. **Basic E2E Tests** (Implement First)

1. **Task**: Create a minimal Docker Compose or [TestContainers Node](https://github.com/testcontainers/testcontainers-node) script that launches:
   - InfluxDB (ephemeral port)
   - Docker Stats Service (pointed to ephemeral Influx)
   - A single test container (e.g., Alpine)
2. **Task**: Wait a short interval, then query Influx for the `docker_stats` measurement.
3. **Task**: Verify at least one data point was written (CPU, memory, net usage).
4. **Task**: Tear down.

**Why**: This ensures the entire pipeline works after each commit or PR. Developers can skip manual checks.

---

### B. **Unit Tests**

1. **`batch.mjs`** (Batch Logic)

   - Task: Test adding points, flushing by size/time.
   - Task: Test retry on write failure (mock `influx.writePoints`).

2. **`influx.mjs`** (Retry & Error Classification)

   - Task: Test exponential backoff logic (mock timers or set small delays).
   - Task: Distinguish fatal vs. retryable errors.

3. **`shutdown.mjs`** (Graceful Shutdown)

   - Task: Verify that all handlers run in order, respecting timeouts.
   - Task: Test multiple registrations, ensuring each runs once.

4. **New or Extended**:
   - **`STATS_FIELDS`** logic
     - Task: `ESSENTIAL` → only CPU, memory, network fields.
     - Task: Custom list → confirm only those fields appear.
     - Task: Missing fields → confirm log warning.

**Why**: Quick to run, good coverage of critical logic.

---

### C. **Integration Tests**

1. **Partial Mocks**:

   - **Mock Docker** + Real Influx:
     - Task: Spin up a real Influx container, mock `docker.getContainer().stats()` calls.
     - Task: Confirm points in the real DB.
   - **Real Docker** + Mock Influx:
     - Task: Actually run Docker containers, but fake `influx.writePoints()` so you can confirm the points structure.

2. **Full Integration** (Local Docker + Local Influx):
   - Task: Start ephemeral Influx + Docker Stats Service.
   - Task: Start a test container (e.g. `busybox -- echo "Hello"`).
   - Task: Confirm metrics arrived in Influx.

**Why**: Verifies real network calls & Docker events in a narrower scope.

---

### D. **Deterministic Simulation Testing (DST)**

1. **Simulate Docker Stats**:

   - Task: Start a Node.js server or local stream that outputs JSON lines matching Docker’s stats format.
   - Task: Control the data (spikes, missing fields, corrupt JSON, etc.).

2. **Integration**:

   - Task: If `NODE_ENV=test` or a special env var is set, redirect your stats logic to read from this “fake” endpoint instead of real Docker.
   - Task: Check that your Batcher receives the exact CPU, memory, etc., and see if it logs parse errors or warnings.

3. **Assertion**:
   - Task: If you feed “CPU=200%”, ensure that’s what your code tries to write to Influx.
   - Task: Test partial/corrupt lines to confirm error handling.

**Why**: No real Docker needed, yet you can test all edge conditions _consistently_.

---

### E. **Advanced/Full E2E Tests**

1. **Multi-Container Scenario**:

   - Task: `docker compose -f docker/docker-compose.yml up -d` includes:
     - Influx, Grafana, Docker Stats Service
     - Possibly multiple containers (e.g., `nginx`, `redis`)
   - Task: Wait for logs to confirm stats are flowing.

2. **Assertions**:

   - Task: Query Influx for CPU, memory usage for each container.
   - Task: Optionally call Grafana’s API or check logs.

3. **Schedule**:
   - Typically run in a separate CI stage or at least not on every commit (slower).
   - Possibly run nightly or on merges to `main`.

**Why**: Full real-world coverage (including UI). Possibly more complex to set up, but ensures complete correctness.

---

## 4. Proposed Order of Implementation

1. **Basic E2E**

   - Implement immediately for quick “sanity check.”
   - This avoids manual overhead for every commit.

2. **Unit Tests**

   - Start building coverage for core logic, especially new features.

3. **Integration Tests**

   - Real Docker or real Influx, partial or full.

4. **Deterministic Simulation (DST)**

   - Mock Docker Stats for stable coverage of special/edge cases.

5. **Advanced/Full E2E**
   - As a final gate or nightly job.

---

## 5. Additional Notes & DST Emphasis

- **DST** is extremely valuable if you have frequent changes in how stats are parsed or if real Docker usage is unreliable in CI.
- For **time-based** fields (like CPU usage deltas), deterministic inputs can drastically reduce flaky test failures.
- Keep an eye on the existing **architecture** references to ensure your test coverage touches each module (e.g., `Event Monitor`, `Container Watcher`, `Stream Manager`, `Metrics Handler`).

---

## 6. Example CI Flow

1. **Lint & Format**
   ```bash
   pnpm lint
   pnpm format:check
   ```
2. **Basic E2E**
   - Quick ephemeral environment test (ensuring we don’t break the main pipeline).
3. **Unit Tests**
   - `pnpm test`
4. **Integration Tests**
   - Possibly spin up ephemeral Docker + Influx, or partial mocking.
5. **DST**
   - Feed in pre-defined stats JSON or a simple stream of test data.
6. **Advanced E2E**
   - Full `docker compose up` with multiple containers, optional Grafana check.
7. **Cleanup**
   - Tear down containers, volumes, etc.

---

## 7. Conclusion

- **Basic E2E** first for immediate coverage → skip daily manual checks.
- **Unit & Integration** for thorough logic coverage.
- **DST** (Deterministic Simulation) for stable corner-case testing.
- **Advanced E2E** as a final comprehensive step (may be triggered less frequently).

This ensures a well-rounded test strategy aligned with your **architecture** and your need to **avoid manual verification** early in development. By layering **DST** and **basic** vs. **advanced** E2E tests, you achieve both fast feedback and comprehensive coverage.
