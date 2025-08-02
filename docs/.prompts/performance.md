# Performance Optimization Prompt

Gilbert targets 200+ pages per second generation. This prompt provides specific guidance for maintaining and improving performance.

## Performance Targets

- **Generation Speed**: 200+ pages/second on typical development hardware
- **Memory Usage**: Minimal footprint through streaming
- **Startup Time**: Sub-second cold start for development workflow

## Profiling and Measurement

### Basic Performance Monitoring

```javascript
// Time critical operations
console.time("pipeline-build");
await pipeline.build();
console.timeEnd("pipeline-build");

// Memory usage monitoring
const before = process.memoryUsage();
await operation();
const after = process.memoryUsage();
console.log("Memory delta:", {
  heapUsed: after.heapUsed - before.heapUsed,
  heapTotal: after.heapTotal - before.heapTotal,
});
```

### Stream Performance Patterns

#### Efficient Stream Processing

```javascript
// Good: Process items one at a time
stream.on("data", (chunk) => {
  processChunk(chunk);
});

// Bad: Accumulate all data in memory (general case)
const allData = [];
stream.on("data", (chunk) => allData.push(chunk));
stream.on("end", () => processAllData(allData));

// Exception: Template loading (required pattern)
// Templates must be fully loaded before data processing begins
// because any data URI can reference any template in any order
const templates = {};
themeStream.on("data", (templateFile) => {
  templates[templateFile.path] = compileTemplate(templateFile.contents);
});
themeStream.on("end", () => {
  // Now safe to start processing data stream
  dataStream.pipe(templateProcessor);
});
```

#### Backpressure Management

```javascript
// Handle backpressure properly
const transform = new Transform({
  objectMode: true,
  transform(chunk, encoding, callback) {
    // Process asynchronously to avoid blocking
    setImmediate(() => {
      const result = processChunk(chunk);
      callback(null, result);
    });
  },
});
```

## Common Performance Anti-Patterns

### Avoid These Patterns

1. **Synchronous File Operations**

   ```javascript
   // Bad: Blocks event loop
   const data = fs.readFileSync("/path/to/file");

   // Good: Use streams or async operations
   const data = await fs.readFile("/path/to/file");
   ```

2. **Loading All Data Into Memory**

   ```javascript
   // Bad: Memory intensive
   const allFiles = await glob("**/*.md");
   const allContent = allFiles.map((f) => fs.readFileSync(f));

   // Good: Stream processing
   const fileStream = createFileStream("**/*.md");
   fileStream.pipe(processStream);
   ```

3. **Nested Async Operations in Streams**

   ```javascript
   // Bad: Creates promise chains in streams
   transform(chunk, encoding, callback) {
     asyncOperation(chunk)
       .then(result => asyncOperation2(result))
       .then(final => callback(null, final));
   }

   // Good: Use async/await with proper error handling
   async transform(chunk, encoding, callback) {
     try {
       const result = await asyncOperation(chunk);
       const final = await asyncOperation2(result);
       callback(null, final);
     } catch (error) {
       callback(error);
     }
   }
   ```

## Pipeline-Specific Optimizations

### TemplatePipeline

- **Pre-load all templates in `prep()`**: Templates must be fully loaded into memory before data processing begins
- **Template loading exception**: Unlike other streams, templates cannot be processed incrementally because any data URI can reference any template in any order
- Cache compiled templates between builds
- Use streaming HTML minification when possible

**Critical Pattern**:

```javascript
// Templates must be fully loaded before data stream processing
async prep() {
  const templates = {};
  // Load ALL templates into memory first
  this.themeStream.on('data', (file) => {
    templates[file.relative] = handlebars.compile(file.contents.toString());
  });
  await streamFinished(this.themeStream);

  // Only after all templates loaded can data processing begin
  this.templates = templates;
}
```

### ScriptsPipeline

- Leverage esbuild's speed advantages
- Use incremental builds for development
- Enable tree shaking for production builds

### StylesheetsPipeline

- Cache PostCSS plugins
- Use autoprefixer only when needed (--prefix-css flag)
- Stream CSS processing when possible

### StaticFilesPipeline

- Use efficient glob patterns
- Stream file copying without loading into memory
- Cache mime type lookups

## Memory Management Best Practices

### Stream Cleanup

```javascript
// Properly clean up streams
pipeline.on("end", () => {
  // Clear any large objects
  this.templates = null;
  this.data = null;
});

// Handle errors to prevent memory leaks
pipeline.on("error", (error) => {
  // Clean up resources
  this.cleanup();
  throw error;
});
```

### Garbage Collection Hints

```javascript
// Force GC during development (not production)
if (process.env.NODE_ENV === "development") {
  global.gc && global.gc();
}
```

## Web Streams Performance Considerations

When migrating to Web Streams:

- Web Streams may have different performance characteristics
- Test thoroughly in target runtimes (Cloudflare Workers have memory limits)
- Use ReadableStream controller queuing strategies for backpressure
- Monitor Worker CPU time limits (10ms for Cloudflare)

## Benchmarking Guidelines

### Test Data Sets

- Small: 10-50 pages
- Medium: 100-500 pages
- Large: 1000+ pages

### Metrics to Track

- Pages per second generation rate
- Peak memory usage
- Time to first file output
- Total build time

### Regression Testing

```javascript
// Simple benchmark harness
const benchmark = async (name, operation) => {
  const start = performance.now();
  const beforeMem = process.memoryUsage();

  await operation();

  const end = performance.now();
  const afterMem = process.memoryUsage();

  console.log(`${name}: ${(end - start).toFixed(2)}ms`);
  console.log(`Memory: ${(afterMem.heapUsed - beforeMem.heapUsed) / 1024 / 1024}MB`);
};
```
