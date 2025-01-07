# Docker Container Stats Explained: A Concise Guide to Dockerode & Docker Stats

## Introduction

Docker provides detailed container metrics—like CPU usage, memory usage, and network I/O—through its **Docker stats** feature. This data is vital for monitoring container performance, understanding resource constraints, and troubleshooting issues.

Tools such as **[Dockerode](https://www.npmjs.com/package/dockerode)** (a Node.js client for Docker) or the built-in **`docker stats`** command can retrieve the **same underlying data** from the Docker Engine. Under the hood, Docker collects these metrics from **[cgroups (control groups)](https://docs.docker.com/config/containers/resource_constraints/)** and the Linux kernel, packaging them into JSON statistics for each container.

This guide provides both a **high-level** and a **technical** overview of how Docker stats work, how Dockerode retrieves the same metrics, and how to interpret CPU/memory usage—especially when containers do not have explicit resource limits.

---

## 1. How Docker Collects Stats

### High-Level Explanation

- **Docker Engine** exposes real-time container usage stats (CPU, memory, network I/O, etc.) via the **Docker API**.
- When you run `docker stats` or use Dockerode’s `container.stats()`, the Docker daemon retrieves these metrics from **cgroup** subsystems in the kernel.
- Docker returns a **JSON object** with fields such as:
  - `cpu_stats`
  - `memory_stats`
  - `precpu_stats`
  - `networks`
  - `blkio_stats`
  - `read` (timestamp)
- The **`cpu_stats`** object includes counters for CPU usage (kernel and user mode) and the total CPU time consumed, as measured by the kernel’s CPU accounting in cgroups.

### Technical Details

Under Linux, **cgroups** track resource usage (CPU time, memory usage, I/O operations, etc.) for each process group. A Docker container is essentially a **cgroup** plus namespaces. The daemon queries these cgroup counters and aggregates the values into Docker’s stats API response.

For more details, see **[Docker Docs - Resource Constraints](https://docs.docker.com/config/containers/resource_constraints/)** for a deeper look.

---

## 1.5. Container Watcher & Stream Manager Flow

The service uses a robust stream management system to handle real-time container stats collection. This system is split into two main components:

### Container Watcher (`containers.mjs`)

The Container Watcher orchestrates the monitoring of Docker containers:

- Discovers and tracks container lifecycle
- Manages stats stream creation and cleanup
- Handles container state changes
- Provides automatic recovery on failures

```js
// Container Watcher simplified flow
const watcher = createContainerWatcher(async (containerId, name, stats) => {
  // Process and store the stats
  await processContainerStats(containerId, name, stats);
});

// Start watching a container
await watcher.watchContainer(containerId, containerName);

// Stop watching (e.g., on container stop)
await watcher.unwatchContainer(containerId);
```

### Stream Manager (`stream-manager.mjs`)

The Stream Manager handles the low-level details of Docker stats streams:

- Maintains stream state and lifecycle
- Handles stream errors and retries
- Prevents duplicate streams
- Implements backpressure handling

```js
// Stream Manager state machine
const streamStates = {
  STARTING: 'starting', // Stream creation initiated
  ACTIVE: 'active', // Stream is receiving stats
  STOPPING: 'stopping', // Stream cleanup initiated
  STOPPED: 'stopped' // Stream fully cleaned up
};

// Simplified stream lifecycle
const stream = await streamManager.addStream(containerId, containerName);
stream
  .on('data', chunk => {
    // Parse and validate stats
    const stats = parseStats(chunk);
    // Notify listeners
    onStats(containerId, containerName, stats);
  })
  .on('error', error => {
    // Handle errors, maybe retry
    streamManager.handleStreamError(containerId, error);
  })
  .on('end', () => {
    // Clean up
    streamManager.removeStream(containerId);
  });
```

### Key Features

1. **Concurrency Control**

   - Single source of truth for stream state
   - Atomic state transitions
   - Prevention of duplicate streams
   - Safe cleanup on container removal

2. **Error Handling**

   - Automatic retry on transient failures
   - Error count tracking per stream
   - Graceful degradation
   - Stream reset on consecutive errors

3. **Resource Management**

   - Proper stream cleanup
   - Memory leak prevention
   - Backpressure handling
   - Efficient stream pooling

4. **State Machine**
   ```
   [Container Start] → STARTING → ACTIVE → STOPPING → STOPPED
          ↑              ↓         ↓
          └──────────────┴─────────┘
           (Auto-retry on error)
   ```

This architecture ensures reliable stats collection while handling the complexities of container lifecycle events and potential failures gracefully.

---

## 2. Retrieving Stats with Dockerode

Dockerode uses Docker’s **Remote API**. Below is a minimal Node.js snippet:

```js
import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

/**
 *
 * @param containerId
 */
async function getContainerStats(containerId) {
  const container = docker.getContainer(containerId);
  // { stream: false } returns the full JSON once
  const stats = await container.stats({ stream: false });
  console.log(stats);
}
```

This `stats` object mirrors what you’d see in the CLI with `docker stats --no-stream --format="{{json .}}"`. You’ll find fields like `cpu_stats`, `memory_stats`, `networks`, etc.

---

## 3. Nature of Data from `docker stats`

A typical **`docker stats`** JSON response includes:

- **`cpu_stats`**

  - `cpu_usage`: counters for user-mode and kernel-mode CPU time
  - `system_cpu_usage`: the total CPU usage on the host
  - `online_cpus`: how many CPU cores were online at the time

- **`precpu_stats`**  
  A snapshot of `cpu_stats` from the previous measurement (useful for calculating deltas).

- **`memory_stats`**

  - `usage`: how many bytes the container is currently using
  - `limit`: the memory limit cgroup assigned (if any)

- **`networks`**

  - For each interface, `rx_bytes` and `tx_bytes`, etc.

- **`read`**
  - An ISO timestamp when Docker took the measurement (e.g., `2025-01-05T16:26:37.422Z`).

---

## 4. What Does the `cpu_stats` Field Mean?

The **`cpu_stats`** field represents the CPU usage details as tracked by cgroups for that container. It typically includes:

- **`cpu_usage.total_usage`**: Total CPU time spent by all container processes in both user mode and kernel mode.
- **`system_cpu_usage`**: Host’s total CPU usage (not just the container), used to calculate relative usage.

A common approach (similar to Docker’s CLI) is:

```js
const cpuDelta = cpu_stats.cpu_usage.total_usage - precpu_stats.cpu_usage.total_usage;
const systemDelta = cpu_stats.system_cpu_usage - precpu_stats.system_cpu_usage;
const onlineCPUs = cpu_stats.online_cpus || 1;

const cpuPercent = (cpuDelta / systemDelta) * onlineCPUs * 100;
```

This yields a **percentage** of the CPU resources used by the container during the sampling interval.

---

## 5. Interpreting CPU Limits & 100% Usage

- If you run a container **without** specifying a CPU limit (e.g., `--cpus=2.0`), Docker may treat the entire host CPU resource as available. **100% usage** in that scenario means the container is fully using **one CPU core**. If the container can use more than one core, you might see >100% usage (e.g., 200% means two cores).

- **If your Docker Compose or `docker run` uses `--cpus=2.0`**, and the metric shows **100%**, that means the container is consuming **100% of the allocated two CPU cores**. In other words, it is maxing out its quota.

> **Reference**: **[Docker Docs - Limit a container’s resources (CPU)](https://docs.docker.com/config/containers/resource_constraints/#cpu)**

---

## 6. Memory Usage Interpretation

- **`memory_stats.usage`**: The current memory usage of the container (in bytes).
- **`memory_stats.limit`**: The maximum memory allocated to the container under cgroups.

If no memory limit is set (`-m`), Docker may set the `limit` to the host’s total memory. If you do specify `-m 512m`, then `limit` will reflect that cgroup constraint (e.g. `536870912` bytes).

---

## 7. Other Metrics

- **Network I/O** (`networks`):  
  For each network interface, Docker shows `rx_bytes`, `tx_bytes`, etc. Summing across all interfaces gives total bytes in/out for the container.

- **Block I/O** (`blkio_stats`):  
  If block `I/O` is relevant, Docker can provide reads/writes at the block level for the container.

---

## Conclusion

**Docker stats** (through the CLI or Dockerode) provides **real-time** metrics on CPU, memory, network, and more. The **`cpu_stats`** field indicates how much CPU time your container has consumed relative to the host’s total CPU time. If there’s no CPU limit, usage can exceed “100%” as the container spans multiple cores. Conversely, if you specify `--cpus=2.0` and see `100%`, it means **the container is using 100% of those 2 allocated cores**. Similarly, **memory usage** compares the container’s memory consumption (`usage`) to either an explicit cgroup `limit` or the host’s total memory if no limit is set.

> **Further Reading**
>
> - [Docker Docs: `docker stats` command reference](https://docs.docker.com/engine/reference/commandline/stats/)
> - [Docker Docs: Resource Constraints (CPU & Memory)](https://docs.docker.com/config/containers/resource_constraints/)
> - [Docker Docs: Dockerode usage in Community Tutorials](https://docs.docker.com/engine/api/sdk/)

Whether you run `docker stats` or call Dockerode’s `container.stats()`, **the data source is the same**: **cgroup** metrics in the Linux kernel—summarized and exposed via Docker’s Remote API.
