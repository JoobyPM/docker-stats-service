# `DRAFT` Concept of Testing Strategy

Below is a recommended multi-layer testing strategy that focuses on **deterministic simulation** where possible, and ensures confidence that each component of your Docker Stats Service works correctly. This includes both traditional unit/integration testing and more specialized “simulation” tests that mimic real Docker/container behavior in a controlled way.

---

## 1. Overview of Testing Strategy

1. **Unit Tests (Offline, No Docker Required)**

   - **Scope:** Smallest testable parts of your code (e.g., batch logic, retry logic, error handling).
   - **Goal:** Quickly validate correctness of pure JavaScript modules (e.g., `batch.mjs`, `influx.mjs`, `shutdown.mjs`).

2. **Integration Tests (Local Docker or Mocks)**

   - **Scope:** Interactions between your service and external systems (Docker Daemon, InfluxDB).
   - **Goal:** Verify the system works end-to-end, but still at a smaller scale than full E2E.

3. **Deterministic Simulation Testing (Mocked Docker Stats)**

   - **Scope:** Replace actual Docker or stats streams with a **simulated Docker Daemon** (or pre-recorded stats) to produce **repeatable** results.
   - **Goal:** Test how your service reacts to a variety of edge cases in container stats without the flakiness of real Docker in real-time.

4. **End-to-End (E2E) Tests (Ephemeral Containers)**
   - **Scope:** Spin up the entire stack (InfluxDB, Grafana, Docker Stats Service, plus one or more test containers) and observe real metrics in InfluxDB.
   - **Goal:** Confirm that the final user flows (from container start → stats collection → Influx → Grafana) function as expected.

---

## 2. Unit Testing Recommendations

Your codebase has many utility modules (e.g., `batch.mjs`, `influx.mjs`, `shutdown.mjs`). These are prime candidates for **pure unit tests**:

1. **Framework**: Since you have `vitest` in your dev dependencies, you can use Vitest (or Jest, or Mocha) for quick feedback.
2. **What to test**:
   - **Batch logic** (`batch.mjs`):
     - Adding points to the batch
     - Flushing based on size/time
     - Retry behavior on write failures
   - **Retry logic** (`influx.mjs`):
     - Exponential backoff calculation
     - Handling “fatal” vs. “retryable” errors
     - Custom error patterns
   - **Graceful shutdown** (`shutdown.mjs`):
     - Execution order of handlers
     - Timeouts
     - Multiple registrations
   - **Error handling**:
     - Ensure “fatal” errors are thrown/not retried
     - Ensure “retryable” errors do indeed retry

**Mock external dependencies** (e.g., `influx.writePoints`) using [Vitest mocks](https://vitest.dev/guide/mocking.html), so your tests remain purely in-memory.

---

## 3. Integration Testing with Docker & Influx

### 3.1 Lightweight Integration (Partial Mocks)

- **Goal**: Validate your service’s interaction with either Docker or InfluxDB—one at a time.
- **Approach**:
  - **Mock Docker** but run a **real InfluxDB** in Docker.
    - Use a throwaway InfluxDB container (e.g., via Docker Compose or TestContainers)
    - Confirm data is successfully written to Influx, verifying real network calls.
  - **Use real Docker** but mock Influx.
    - For instance, mock `influx.writePoints()` and confirm that points are prepared correctly.

### 3.2 Full Integration (Local Docker + Local Influx)

- **Goal**: Spin up a real InfluxDB + real Docker environment, but keep the tests “narrow” by only verifying a small number of containers.
- **Approach**:
  1. Start InfluxDB in Docker on ephemeral ports (using Docker Compose or TestContainers).
  2. Start the Docker Stats Service (point it to ephemeral Influx).
  3. Start a minimal test container (e.g., busybox or Alpine) that runs for a short time.
  4. Verify the Stats Service writes correct points to Influx.

This ensures the code is actually talking to a Docker daemon, retrieving stats, and writing to Influx—**no mocks**.

---

## 4. Deterministic Simulation Testing (Recommended)

A frequent problem with “live” Docker metrics is they are **inherently time-based and can fluctuate**. This can cause flakiness in tests. To achieve **deterministic** results:

1. **Simulated Docker Daemon (Mock Stats Stream)**

   - **Idea**: Instead of calling `docker.getContainer(id).stats({stream: true})`, you can inject a “fake” or “mocked” stats stream that pushes pre-defined JSON stats frames.
   - **Implementation**:
     - Create a small HTTP server or a Node.js stream that **emits JSON lines** exactly how Docker would, but with your chosen data (CPU usage, memory usage, etc.).
     - In your code, **swap** the real Docker call with an option to connect to this mock stream if `NODE_ENV=test` or via an environment flag.
     - This approach ensures:
       - CPU usage or memory usage is the same on each test run.
       - You can test extreme scenarios (e.g., “unparsable JSON line,” “stats spiking to 200% CPU,” “missing fields,” etc.) in a fully scripted manner.

2. **Pre-recorded Stats**

   - If you already have example stats JSON from real Docker sessions, feed them back in a fixed sequence.
   - This avoids the overhead of an actual Docker daemon but still uses “realistic” data.

3. **Assertion**
   - Wait for your service to parse all the stats, then check the **batcher’s** internal queue or the final calls to `influx.writePoints`.
   - Compare the metrics with known expected values. For example, you might expect “CPU usage = 150%,” “Memory usage = 100MB,” etc.

**Benefits**:

- Repeatable across CI runs
- No time-based flakiness
- Allows negative tests (e.g., corrupt JSON, missing fields) that are hard to produce with real Docker

---

## 5. End-to-End Testing

Even with deterministic simulations, it is valuable to run the entire stack as a final check. This is typically done in a separate job (or stage) in your CI/CD pipeline:

1. **Spin Up**:
   - `docker compose -f docker/docker-compose.yml up -d` (InfluxDB, Grafana, Docker Stats Service).
   - Optionally, add your test container(s) in the same `docker-compose.yml` or spawn them after the main services are up.
2. **Wait** for service readiness:
   - Wait for InfluxDB’s health check to pass.
   - Wait for the Stats Service logs to indicate it’s running.
3. **Assert**:
   - The Stats Service is indeed writing data to Influx (`SHOW MEASUREMENTS` or query the `docker_stats` measurement).
   - Optionally, do an **HTTP request** to Grafana’s API (or just check logs) to ensure the dashboard is up.
4. **Tear down**:
   - `docker compose -f docker/docker-compose.yml down -v`

These tests are **slower** and more “real,” so it’s normal to keep them as a final integration gate rather than run them on every commit.

---

## 6. Practical Tips & Tooling

1. **Vitest Setup**:

   - Create a `tests/` folder (or `__tests__`) with `.test.mjs` files.
   - Configure Vitest to pick up these files. Example:
     ```jsonc
     // package.json
     {
       "scripts": {
         "test": "vitest run"
       }
     }
     ```
   - Use inline mocks for Docker or Influx clients for unit tests.

2. **TestContainers / Docker Compose**:

   - **[TestContainers Node](https://github.com/testcontainers/testcontainers-node)** is a popular library that automatically starts/stops containers (like InfluxDB) in your tests, making it easy to do ephemeral integration testing.
   - Alternatively, you can script your Docker Compose approach with ephemeral ports for CI.

3. **Environment Variables for Testing**:

   - Use distinct DB names or ephemeral ports in test. Example: `INFLUXDB_DB=test_db_123`.
   - Ensure you don’t accidentally clobber real data in your dev or production InfluxDB.

4. **Mocking the Docker Socket**:

   - For the deterministic simulation tests, you can **avoid mounting the real `/var/run/docker.sock`**. Instead, your code uses a “fake socket” or an environment variable that triggers the fake Docker stream.

5. **Retry + Backoff**:
   - If your tests rely on waiting for the service to reconnect, be mindful of the added wait times from exponential backoff. In local tests, you can override certain environment variables to make them faster:
     ```bash
     INFLUXDB_RETRY_MAX=1   # reduce retries
     INFLUXDB_RETRY_DELAY=500
     INFLUXDB_RETRY_MAX_DELAY=1000
     ```
   - Alternatively, mock out `withRetry()` so your tests complete quickly.

---

## 7. Putting It All Together

A **typical** development/CI pipeline might look like this:

1. **Lint & Format Check**

   - `pnpm lint`, `pnpm format:check`

2. **Unit Tests**

   - `vitest run` or `pnpm test`
   - Purely in-memory with mocks. Runs in seconds.

3. **Deterministic Simulation Tests**

   - Spin up a minimal “fake Docker daemon” stream or feed pre-canned JSON.
   - Confirm your service processes CPU/memory stats as expected.
   - Very stable and repeatable—no real Docker needed.

4. **Integration Tests**

   - Start ephemeral InfluxDB via Docker or TestContainers.
   - Start the Docker Stats Service in test mode.
   - Possibly mock Docker or run minimal real Docker to see if metrics are indeed stored in Influx.
   - Check `docker_stats` measurement for expected points.

5. **E2E Tests** (optional in every commit, mandatory in release branch)

   - `docker compose up` the entire environment (Influx, Grafana, Stats Service, plus test container).
   - Wait a few seconds for data to appear in Influx.
   - Query Influx or check logs.
   - Confirm that everything works as a complete system.

6. **Cleanup**
   - `docker compose down -v` or let TestContainers handle cleanup automatically.

---

### Final Thoughts

- **“Deterministic simulation”** is the most critical piece if you want stable, fast, and repeatable tests for container stats. By injecting your own “stats stream,” you can test edge cases or stable CPU usage flows without real Docker timing noise.
- Combine that with a final **end-to-end** test in an actual Docker environment for confidence that everything truly works.
- This layered approach ensures each part of your system (utilities, batching, retry logic, event listening, stats parsing) is covered—both in isolation and in the final integrated environment.

---

**Summary**:  
Adopting a **multi-layer** test strategy (unit, integration, deterministic simulation, E2E) is the best way to ensure high coverage and reliability in a system that interacts with Docker and Influx. This approach balances **confidence** (through real integration) and **speed/determinism** (through mocking/simulation). By isolating Docker stats behind a fake or pre-recorded stream, you can validate all corner cases of your metrics processing code, all while avoiding brittle, real-time Docker dependencies.
