# Gilbert Developer Guide <!-- omit in toc -->

_This document demonstrates a unified approach to documentation that serves both human developers and AI agents. It combines philosophical context for humans with specific technical patterns for AI._

## Table of Contents <!-- omit in toc -->

- [About](#about)
  - [Philosophy: The Mind's DOM](#philosophy-the-minds-dom)
  - [Performance-First Architecture](#performance-first-architecture)
- [Core Architecture](#core-architecture)
  - [Streams-Based Processing](#streams-based-processing)
  - [Pipeline Architecture](#pipeline-architecture)
  - [Virtual File System](#virtual-file-system)
- [Development Workflows](#development-workflows)
  - [Local Development](#local-development)
  - [Code Style \& Formatting](#code-style--formatting)
  - [Testing Patterns](#testing-patterns)
  - [Debugging Streams](#debugging-streams)
- [Migration Guide: Web Streams](#migration-guide-web-streams)

## About

Gilbert is a streams-based, data-driven static site generator designed for exceptional performance. This guide provides both the philosophical context ("why") and specific implementation patterns ("how") needed for effective development.

### Philosophy: The Mind's DOM

Gilbert's template philosophy centers on the "mind's DOM" concept - developers must be able to easily visualize and mentally render templates without cognitive overhead.

**Human Context**: Complex template logic creates mental burden. Simple token replacement allows developers to maintain clear mental models of output.

> **AI Note**: Templates use minimal Handlebars logic only: `{{#if}}`, `{{#each}}`, and `{{variable}}` replacement. Avoid complex helpers or nested logic. If template logic becomes complex, move it to data transformation upstream.

**Benefits**:

- Faster debugging and development
- Easier collaboration and handoffs
- Predictable performance characteristics
- Clear separation between data and presentation

### Performance-First Architecture

Gilbert targets 200+ pages per second generation with minimal memory footprint.

**Human Context**: This performance enables real-time publishing workflows and serverless deployments at scale.

> **AI Note**: Always benchmark changes against the 200 pages/second target. Use `console.time()` around pipeline operations. Profile memory usage with `process.memoryUsage()`. Reject changes that significantly impact performance without corresponding functionality gains.

## Core Architecture

### Streams-Based Processing

Gilbert processes content through Node.js streams (migrating to Web Streams for WinterCG compatibility).

**Human Context**: Streams enable processing large datasets without loading everything into memory, critical for scalability.

> **AI Note**:
>
> - Always use `objectMode: true` for file streams
> - Implement Transform streams with proper error handling
> - Use `Utils.streamsFinish()` to wait for multiple streams
> - Current migration: Replace Node.js streams with Web Streams API for Cloudflare Workers compatibility

```javascript
// Current pattern (Node.js streams)
const pipeline = new Transform({
  objectMode: true,
  transform(file, encoding, callback) {
    // Process file
    callback(null, file);
  },
});

// Target pattern (Web Streams) - use for new code
const pipeline = new TransformStream({
  transform(file, controller) {
    // Process file
    controller.enqueue(file);
  },
});
```

### Pipeline Architecture

Gilbert uses specialized pipelines for different content types: templates, scripts, stylesheets, and static files.

**Human Context**: Separation of concerns allows each pipeline to optimize for its specific content type and processing requirements.

> **AI Note**: All pipelines follow this interface:
>
> - Constructor: `(options, ...inputStreams)`
> - `async prep()`: Load and parse dependencies
> - `async build()`: Process and emit to `this.stream`
> - Property: `this.stream` - Readable stream output
>
> **Critical Exception - Template Loading**: Unlike other pipelines, TemplatePipeline must load ALL templates into memory during `prep()` before data processing begins. This is because any data URI can reference any template in any order.

**Pipeline Responsibilities**:

- `TemplatePipeline`: Handlebars + data merging, HTML minification _(requires full template pre-loading)_
- `ScriptsPipeline`: esbuild bundling, ES module processing
- `StylesheetsPipeline`: PostCSS, autoprefixing, minification
- `StaticFilesPipeline`: Asset copying with mime type detection

```javascript
// Template Pipeline Exception Pattern
async prep() {
  const templates = {};
  // MUST load all templates before data processing
  this.themeStream.on('data', (file) => {
    templates[file.relative] = handlebars.compile(file.contents.toString());
  });
  await streamFinished(this.themeStream);
  this.templates = templates; // Now safe to process data
}
```

### Virtual File System

Gilbert uses GilbertFile objects (custom Vinyl implementation) instead of filesystem operations.

**Human Context**: Virtual files enable in-memory processing and easy testing without filesystem dependencies.

> **AI Note**:
>
> - Always use `Utils.vinyl(options)` factory, never direct GilbertFile constructor
> - Set `options.cwd = "/"` for consistent virtual filesystem behavior
> - Use `path.resolve()` for all path operations
> - File contents should be Buffer objects for binary compatibility

```javascript
// Correct file creation
import { vinyl } from "./Utils.js";
const file = vinyl({
  path: "/index.html",
  contents: Buffer.from(htmlContent),
  cwd: "/",
});

// Access patterns
console.log(file.relative); // "index.html"
console.log(file.dirname); // "/"
console.log(file.extname); // ".html"
```

## Development Workflows

### Local Development

**Human Context**: Gilbert is designed for rapid iteration during development with selective pipeline execution.

> **AI Note**: Development commands and patterns:
>
> ```bash
> # Full build
> npx gilbert
>
> # Skip pipelines for faster iteration
> npx gilbert --no-scripts --no-css  # Only templates + static files
> npx gilbert --no-files             # Skip asset copying
> ```

**Workspace Setup**:

```bash
# Install dependencies (uses implicit npm workspace linking)
npm install

# Run from example project
cd examples/getting-started
npx gilbert
```

### Code Style & Formatting

**Human Context**: This project uses ESLint and Prettier for automated code formatting and style enforcement with format-on-save enabled in VSCode.

> **AI Note**: Follow the project's established code style:
>
> - **Config files**: `eslint.config.js` (project root) + Prettier integration
> - **Module system**: ES modules (`import`/`export`, `type: "module"`)
> - **Quotes**: Double quotes (`"string"`)
> - **Line length**: Max 132 characters
> - **Variables**: Use `const` by default, `let` when reassignment needed
> - **Arrow functions**: Use concise body when possible (`() => value`)
> - **Console**: Use `console.log()` sparingly (ESLint warns)
> - **Async/await**: Preferred over promise chains
> - **Private fields**: Use `#privateField` syntax for class privates
>
> **Generated code will be auto-formatted** by VSCode on save via Prettier, so focus on logic correctness over spacing/formatting details.

### Testing Patterns

**Human Context**: Gilbert uses Node.js built-in test runner for fast, dependency-free testing.

> **AI Note**: Testing conventions:
>
> - Test files: `**/*.test.js` pattern
> - Use `node:test` module: `import { test, describe, it } from "node:test"`
> - Test GilbertFile objects with mock data, not filesystem
> - Use `assert.strictEqual()` for exact matches
> - Stream testing: Create mock Transform streams for pipeline testing

```javascript
// Example test pattern
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { vinyl } from "../lib/Utils.js";

describe("Pipeline", () => {
  test("should process file correctly", async () => {
    const input = vinyl({ path: "/test.txt", contents: Buffer.from("test") });
    const result = await pipeline.process(input);
    assert.strictEqual(result.contents.toString(), "processed test");
  });
});
```

### Debugging Streams

**Human Context**: Stream debugging requires understanding event flow and timing.

> **AI Note**: Debugging utilities and patterns:
>
> - Use `Utils.streamLog(stream)` for event monitoring
> - Log stream states: `data`, `end`, `finish`, `error` events
> - Check file paths with `console.log(file.path, file.relative)`
> - Verify content types with `console.log(file.contentType)`
> - Memory debugging: `console.log(process.memoryUsage())`

## Migration Guide: Web Streams

**Human Context**: Migrating to Web Streams enables deployment to Cloudflare Workers and other WinterCG-compatible runtimes.

> **AI Note**: Migration checklist for new code:
>
> - Replace `require('stream').Transform` with `TransformStream`
> - Replace `require('stream').Readable` with `ReadableStream`
> - Update stream patterns:
>
>   ```javascript
>   // Old: Node.js streams
>   stream.on("data", handler);
>   stream.pipe(destination);
>
>   // New: Web Streams
>   const reader = stream.getReader();
>   stream.pipeTo(destination);
>   ```
>
> - Test in multiple runtimes: Node.js, Bun, Cloudflare Workers
> - Maintain backward compatibility during transition

**Target Deployment**: Cloudflare Workers triggered by CMS webhooks for real-time publishing.

---

> **AI Development Note**: This template demonstrates unified documentation patterns. When updating this guide:
>
> 1. Maintain both human context (philosophy, benefits) and AI specifics (code patterns, interfaces)
> 2. Use `> **AI Note**:` callouts for implementation details
> 3. Include working code examples that AI agents can reference
> 4. Keep performance considerations visible throughout
> 5. Update migration guidance as Web Streams transition progresses
