# Development Guide

This guide outlines the development workflow and best practices for contributing to the Docker Stats Service.

## Development Environment

### Prerequisites

1. **Node.js**

   - Version 18 or later
   - pnpm package manager

2. **Docker**

   - Docker Engine 20.10.0 or later
   - Docker Compose v2.0.0 or later

3. **Development Tools**
   - Git
   - VSCode (recommended)
   - ESLint
   - Prettier

### Setup

1. **Clone Repository**

   ```bash
   git clone https://github.com/your-org/docker-stats-service.git
   cd docker-stats-service
   ```

2. **Install Dependencies**

   ```bash
   pnpm install
   ```

3. **Configure Environment**

   ```bash
   # Create .env file
   cat > .env << EOL
   # InfluxDB settings (v1.X)
   INFLUXDB_HOST=localhost
   INFLUXDB_PORT=8086
   INFLUXDB_PROTOCOL=http
   INFLUXDB_USER=admin
   INFLUXDB_PASS=admin
   INFLUXDB_DB=docker_stats

   # Development settings
   DEBUG=docker-stats:*
   BATCH_SIZE=50
   BATCH_WAIT_MS=1000
   EOL
   ```

## Project Structure

```
src/
├── services/           # Core services
│   ├── docker/        # Docker interaction
│   └── metrics/       # Metrics handling
├── types/             # Type definitions
├── config/            # Configuration
└── utils/             # Shared utilities

test/
├── unit/             # Unit tests
├── integration/      # Integration tests
└── fixtures/         # Test fixtures

docs/
├── guides/           # User guides
├── reference/        # API reference
└── architecture/     # Architecture docs
```

## Development Workflow

### 1. Feature Development

1. **Create Branch**

   ```bash
   git checkout -b feature/my-feature
   ```

2. **Implement Changes**

   - Follow coding standards
   - Add tests
   - Update documentation

3. **Local Testing**

   ```bash
   # Run tests
   pnpm test

   # Run linter
   pnpm lint

   # Format code
   pnpm format
   ```

### 2. Testing

1. **Unit Tests**

   ```bash
   # Run unit tests
   pnpm test:unit

   # Watch mode
   pnpm test:unit:watch
   ```

2. **Integration Tests**

   ```bash
   # Run integration tests
   pnpm test:integration

   # With coverage
   pnpm test:integration:coverage
   ```

3. **Test Coverage**
   ```bash
   # Generate coverage report
   pnpm test:coverage
   ```

### 3. Documentation

1. **Code Documentation**

   - Use JSDoc comments
   - Document public APIs
   - Include examples

2. **Update Guides**
   - Keep README.md current
   - Update relevant guides
   - Add new documentation

## Coding Standards

### JavaScript

1. **Style Guide**

   - ESLint configuration
   - Prettier formatting
   - Import ordering

2. **Best Practices**
   ```js
   // Use async/await
   async function getStats(containerId) {
     try {
       const stats = await docker.getContainer(containerId).stats();
       return stats;
     } catch (error) {
       logger.error('Failed to get stats', { containerId, error });
       throw error;
     }
   }
   ```

### Type Definitions

1. **JSDoc Types**

   ```js
   /**
    * @typedef {Object} ContainerStats
    * @property {string} containerId - Container ID
    * @property {Object} cpu - CPU statistics
    * @property {number} cpu.usage - CPU usage percentage
    */

   /**
    * Process container stats
    * @param {ContainerStats} stats
    * @returns {Promise<void>}
    */
   async function processStats(stats) {
     // Implementation
   }
   ```

2. **Type Exports**
   ```js
   /**
    * @typedef {import('../types').ContainerStats} ContainerStats
    */
   ```

## Testing Guidelines

### Unit Tests

```js
describe('Stream Manager', () => {
  let streamManager;

  beforeEach(() => {
    streamManager = createStreamManager();
  });

  it('should create new stream', async () => {
    const stream = await streamManager.addStream('container-1');
    expect(stream).toBeDefined();
    expect(stream.state).toBe('starting');
  });
});
```

### Integration Tests

```js
describe('Container Monitoring', () => {
  let docker;
  let container;

  beforeAll(async () => {
    docker = new Docker();
    container = await docker.createContainer({
      Image: 'nginx',
      name: 'test-container'
    });
  });

  it('should collect container stats', async () => {
    await container.start();
    const stats = await collectStats(container.id);
    expect(stats).toHaveProperty('cpu');
    expect(stats).toHaveProperty('memory');
  });
});
```

## Debugging

### Local Development

1. **Debug Logging**

   ```bash
   # Enable all debug logs
   DEBUG=docker-stats:* pnpm start

   # Enable specific components
   DEBUG=docker-stats:stream,docker-stats:events pnpm start
   ```

2. **VSCode Debug**
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "type": "node",
         "request": "launch",
         "name": "Debug Service",
         "program": "${workspaceFolder}/src/index.mjs",
         "env": {
           "DEBUG": "docker-stats:*"
         }
       }
     ]
   }
   ```

### Troubleshooting

1. **Common Issues**

   - Docker socket permissions
   - InfluxDB connection
   - Stream errors

2. **Debug Tools**
   - Node.js debugger
   - Docker logs
   - InfluxDB queries

## Release Process

### 1. Version Bump

```bash
# Update version
pnpm version patch # or minor/major

# Update changelog
pnpm changelog
```

### 2. Testing

```bash
# Run all tests
pnpm test:all

# Build package
pnpm build
```

### 3. Documentation

```bash
# Generate docs
pnpm docs:generate

# Review changes
pnpm docs:serve
```

## Further Reading

- [Architecture Overview](../architecture/README.md)
- [Configuration Guide](../configuration.md)
