# Pipeline Architecture Deep Dive

This prompt provides detailed context about Gilbert's pipeline architecture for AI agents working on pipeline-related code.

## Pipeline Design Patterns

All Gilbert pipelines follow a consistent interface and lifecycle:

### Constructor Pattern

```javascript
class ExamplePipeline {
  constructor(options, ...inputStreams) {
    this.#options = options;
    this.#inputStreams = inputStreams;

    // Create output stream
    this.stream = new Readable({
      objectMode: true,
      read() {
        this.push(null);
      },
    });
  }
}
```

### Lifecycle Methods

1. **`async prep()`**: Load and parse all dependencies

   - Parse input streams into memory
   - Compile templates, load configurations
   - Prepare any heavy lifting before processing

2. **`async build()`**: Process and emit files
   - Transform input data using prepared dependencies
   - Create GilbertFile objects using `Utils.vinyl()`
   - Push to `this.stream`

### Current Pipeline Implementations

#### TemplatePipeline

- **Input**: Data stream (JSON), Theme stream (Handlebars files)
- **Processing**: Merge data with templates, minify HTML
- **Output**: Static HTML files
- **Key method**: `parseFiles()` loads templates and data into memory

#### ScriptsPipeline

- **Input**: Entry point file paths
- **Processing**: esbuild bundling, minification, sourcemaps
- **Output**: Bundled JavaScript files
- **Key method**: Uses esbuild's programmatic API

#### StylesheetsPipeline

- **Input**: CSS file paths
- **Processing**: PostCSS transformation, autoprefixing
- **Output**: Processed CSS files
- **Key method**: PostCSS plugin pipeline

#### StaticFilesPipeline

- **Input**: File glob patterns
- **Processing**: Copy with proper mime types
- **Output**: Static assets (images, fonts, etc.)
- **Key method**: Stream processing with mime detection

## Implementation Guidelines

### Error Handling

```javascript
// Wrap async operations in try/catch
try {
  const result = await heavyOperation();
  this.stream.push(vinyl({ path: result.path, contents: result.buffer }));
} catch (error) {
  this.stream.destroy(error);
}
```

### Memory Management

- Use streams to avoid loading large datasets
- Process files one at a time when possible
- Clear large objects after processing

### Performance Considerations

- Minimize synchronous operations in streams
- Use workers for CPU-intensive tasks if needed
- Profile memory usage with `process.memoryUsage()`

## Web Streams Migration Notes

When updating pipelines for Web Streams compatibility:

1. Replace Node.js stream constructors with Web Stream APIs
2. Update event handling patterns
3. Test in target runtimes (Cloudflare Workers, Bun, Deno)

Example migration pattern:

```javascript
// Old: Node.js Transform stream
const transform = new Transform({
  objectMode: true,
  transform(chunk, encoding, callback) {
    // Process chunk
    callback(null, processedChunk);
  },
});

// New: Web TransformStream
const transform = new TransformStream({
  transform(chunk, controller) {
    // Process chunk
    controller.enqueue(processedChunk);
  },
});
```
