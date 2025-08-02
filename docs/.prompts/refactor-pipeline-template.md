# Task Template: Refactor Pipeline

Use this template when refactoring existing pipelines or creating new ones.

## Pre-Refactor Checklist

- [ ] Understand current pipeline's inputs and outputs
- [ ] Identify performance bottlenecks (if any)
- [ ] Review existing tests and ensure they pass
- [ ] Document current behavior before changes

## Refactoring Guidelines

### Interface Compliance

Ensure your pipeline follows the standard interface:

```javascript
class YourPipeline {
  constructor(options, ...inputStreams) {
    this.#options = options;
    this.stream = new Readable({
      objectMode: true,
      read() {
        this.push(null);
      },
    });
  }

  async prep() {
    // Load dependencies, parse inputs
  }

  async build() {
    // Process and emit to this.stream
  }
}
```

### File Creation Pattern

Always use the Utils factory:

```javascript
import { vinyl } from "./Utils.js";

const file = vinyl({
  path: "/output.html",
  contents: Buffer.from(processedContent),
  cwd: "/",
});

this.stream.push(file);
```

### Error Handling

Wrap operations in try/catch and properly handle stream errors:

```javascript
async build() {
  try {
    // Your processing logic
    const result = await processData();
    this.stream.push(vinyl({ path: result.path, contents: result.buffer }));
  } catch (error) {
    this.stream.destroy(error);
  }
}
```

## Testing Strategy

### Unit Tests

- Test pipeline initialization
- Test prep() method with mock data
- Test build() method with known inputs
- Test error conditions

### Integration Tests

- Test full pipeline with real data
- Verify output stream contains expected files
- Performance regression tests

### Example Test Structure

```javascript
import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("YourPipeline", () => {
  test("should initialize correctly", () => {
    const pipeline = new YourPipeline(options);
    assert.ok(pipeline.stream);
  });

  test("should process data correctly", async () => {
    const pipeline = new YourPipeline(options, inputStream);
    await pipeline.prep();
    await pipeline.build();

    // Collect output
    const outputs = [];
    pipeline.stream.on("data", (file) => outputs.push(file));
    await streamFinished(pipeline.stream);

    assert.strictEqual(outputs.length, expectedCount);
  });
});
```

## Performance Considerations

- [ ] Benchmark before and after refactoring
- [ ] Monitor memory usage during processing
- [ ] Ensure streaming behavior (no full dataset in memory)
- [ ] Test with large datasets (1000+ files)

## Web Streams Migration Notes

If updating for Web Streams compatibility:

- Replace Node.js streams with Web Streams API
- Update event patterns and error handling
- Test in target runtimes (Cloudflare Workers, Bun, Deno)
- Maintain backward compatibility during transition

## Post-Refactor Checklist

- [ ] All tests pass
- [ ] Performance meets or exceeds previous version
- [ ] Documentation updated
- [ ] Examples still work
- [ ] No memory leaks in stream processing
