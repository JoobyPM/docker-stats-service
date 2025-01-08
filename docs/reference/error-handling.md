# Error Handling

This reference guide details how the Docker Stats Service handles various error scenarios.

## Error Categories

### Docker API Errors

1. **Connection Errors**

   - Docker daemon unreachable
   - Network timeouts
   - Socket errors

2. **API Response Errors**
   - Invalid responses
   - Rate limiting
   - Permission denied

### Stream Errors

1. **Stream Creation**

   - Container not found
   - Access denied
   - Resource limits

2. **Stream Processing**
   - Parse failures
   - Buffer overflow
   - Timeout errors

### Validation Errors

1. **Container Validation**

   - Invalid container ID
   - Container state mismatch
   - Missing metadata

2. **Stats Validation**
   - Invalid JSON format
   - Missing required fields
   - Data type mismatches

## Error Recovery Strategies

### Automatic Retry

1. **Retry Configuration**

   ```js
   // Example retry settings
   const retryConfig = {
     maxAttempts: 3,
     backoffMs: 1000,
     maxBackoffMs: 5000
   };
   ```

2. **Backoff Strategy**
   - Initial delay
   - Exponential increase
   - Maximum delay cap

### Graceful Degradation

1. **Partial Failures**

   - Continue with available data
   - Skip invalid records
   - Log errors for analysis

2. **Service Recovery**
   - Maintain partial service
   - Isolate failures
   - Auto-heal when possible

## Error Handling Patterns

### Try-Catch Blocks

```js
try {
  // Critical operation
  await performOperation();
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    // Handle connection error
    await handleConnectionError(error);
  } else {
    // Handle other errors
    await handleGenericError(error);
  }
}
```

### Error Propagation

1. **Error Enrichment**

   ```js
   class StreamError extends Error {
     constructor(message, containerId, originalError) {
       super(message);
       this.containerId = containerId;
       this.cause = originalError;
     }
   }
   ```

2. **Error Chaining**
   - Preserve stack traces
   - Add context
   - Maintain cause chain

## Logging and Monitoring

### Error Logging

1. **Log Levels**

   ```
   // Error severity levels
   ERROR   - Critical failures
   WARN    - Recoverable issues
   INFO    - Important events
   DEBUG   - Diagnostic info
   ```

2. **Log Format**
   ```
   {
     level: 'ERROR',
     timestamp: '2024-01-20T10:30:00Z',
     error: 'Stream creation failed',
     containerId: 'abc123',
     details: {...}
   }
   ```

### Error Metrics

1. **Key Metrics**

   - Error rates
   - Recovery success
   - Retry counts

2. **Alerting**
   - Error thresholds
   - Recovery failures
   - Resource exhaustion

## Best Practices

### Error Prevention

1. **Input Validation**

   - Validate early
   - Fail fast
   - Clear error messages

2. **Resource Management**
   - Monitor limits
   - Clean up resources
   - Prevent leaks

### Error Recovery

1. **Isolation**

   - Contain failures
   - Protect resources
   - Maintain stability

2. **Monitoring**
   - Track error patterns
   - Monitor recovery
   - Alert on issues

## Common Error Scenarios

### Docker Daemon Issues

1. **Daemon Unreachable**

   ```
   Error: connect ECONNREFUSED /var/run/docker.sock
   ```

   - Check daemon status
   - Verify permissions
   - Check network

2. **API Errors**
   ```
   Error: 404 container not found
   ```
   - Validate container ID
   - Check container state
   - Verify API version

### Stream Processing

1. **Parse Errors**

   ```
   Error: Invalid JSON in stats stream
   ```

   - Check data format
   - Validate schema
   - Handle partial data

2. **Resource Errors**
   ```
   Error: Stream buffer overflow
   ```
   - Adjust buffer size
   - Handle backpressure
   - Monitor memory

## Further Reading

- [Stream Management](../guides/stream.md)
- [Configuration](../configuration.md)
- [Docker API Reference](https://docs.docker.com/engine/api/)
