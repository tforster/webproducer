# Copilot Instructions for Gilbert (WebProducer)

## Project Overview
Gilbert is a **streams-based, data-driven static site generator** that processes content through pipeline architectures. Unlike traditional file-based generators, Gilbert transforms data streams through specialized pipelines to generate HTML, CSS, and JavaScript with exceptional performance.

While Gilbert's primary use case is static website and web app generation it can also be thought of as a textfile compiler. Given the correctly formatted template Gilbert can generate almost any non-binary text based file including XML, PostScript, SVG, and many more.

**Core Philosophy**: Gilbert is designed as a high-speed, low-memory aggregator that combines multiple input streams into a single output stream. It assumes upstream applications have already transformed data into the required format, allowing Gilbert to focus purely on fast file generation (200+ pages/second on typical hardware).

## Core Architecture

### Monorepo Structure (npm workspaces)
- **`services/gilbert`**: Main compiler engine with pipeline classes
- **`services/gilbert-file`**: Custom Vinyl-compatible file object (replaces vinyl dependency)
- **`services/gilbert-cli`**: Command-line interface using Commander.js. The CLI project is currently parked and not actively maintained.

### Key Design Principles
1. **Streams-first**: All processing uses Node.js streams for memory efficiency. **Migrating to Web Streams** for WinterCG compatibility and runtime portability (Cloudflare Workers, Bun, Deno, etc.)
2. **Pipeline-based**: Separate pipelines for templates, scripts, stylesheets, and static files
3. **Virtual files**: Uses GilbertFile objects (custom Vinyl implementation) instead of filesystem
4. **Data-driven**: Templates merge with pre-transformed JSON data (no data transformation within Gilbert)
5. **Performance-first**: Designed for 200+ pages/second generation with minimal memory footprint

### Critical Components

#### Pipeline Classes (`services/gilbert/lib/`)
- `TemplatePipeline.js`: Handlebars template processing with data merging
- `ScriptsPipeline.js`: JavaScript bundling via esbuild
- `StylesheetsPipeline.js`: CSS processing with PostCSS/Autoprefixer
- `StaticFilesPipeline.js`: Static asset copying
- `Utils.js`: Core utilities including `vinyl()` factory for GilbertFile creation

#### GilbertFile Object (`services/gilbert-file/`)
- Custom implementation replacing Vinyl dependency
- Manages virtual file system with path resolution
- Handles content types, stat objects, and file history
- Use `Utils.vinyl(options)` factory method, not direct constructor

## Development Workflows

### Local Development Setup
```bash
# Install from monorepo root (uses npm workspaces implicit linking)
npm install
```

### Testing
- Uses Node.js built-in test runner (`node:test`)
- Run tests: `npm test` in individual packages
- Test files: `**/*.test.js` pattern

## Critical Patterns

### Data Structure Convention
JSON data uses `uris` property for page definitions where the object key (e.g. /index) is the final URI in the site and the object value is data that is replaced in the handlebars template indicated by the webProducerKey. **Data must arrive pre-transformed** - Gilbert does not perform data transformation.
```json
{
  "uris": {
    "/index": { "webProducerKey": "homepage", ... },
    "/about": { "webProducerKey": "page", ... }
  }
}
```

### Template Resolution
- `webProducerKey` maps to `.hbs` files in theme directory
- Supports path separators: `"admin/report/detail"` → `admin/report/detail.hbs`
- Templates use minimal Handlebars logic (if/then, loops only). Note that the choice to use if/then and loops only is to ensure extremely fast processing **and** allow developers to easily load the template into their "mind's DOM". Templates with complex embedded logic are inherintly difficult to visualise, develop and debug. This does imply that the data must be properly formated first and is a key differentiator between Gilbert and all other static site generators.

### Stream Processing Pattern
```javascript
// All pipelines follow this pattern
const pipeline = new TemplatePipeline(options, dataStream, themeStream);
await pipeline.prep(); // Load and parse dependencies
pipeline.build(); // Process and emit to stream
```

### File Object Creation
```javascript
// Always use Utils.vinyl() factory
import { vinyl } from "./Utils.js";
const file = vinyl({ path: "/index.html", contents: Buffer.from(html) });
```

## Dependencies & Integration

### Workspace Dependencies
- `gilbert` depends on `@tforster/gilbert-file` using standard npm dependency (not `workspace:` protocol)
- Uses implicit npm workspace linking for local development

### External Dependencies
- **esbuild**: JavaScript bundling and minification
- **handlebars**: Template processing
- **postcss/autoprefixer**: CSS processing
- **html-minifier**: HTML optimization
- **mime**: Content-type detection

### Known Issues
- `html-minifier` has known vulnerability (low risk for build-time usage)
- Project transitioning from Vinyl to custom GilbertFile implementation

## Common Tasks

### Performance Considerations
- **Maintain 200+ pages/second target**: Always consider performance impact when making changes
- **Memory efficiency**: Use streams to avoid loading entire datasets into memory
- **Virtual filesystem**: Keep `options.cwd` as "/" for consistent path resolution

### Web Streams Migration (WinterCG Compatibility)
- **Target runtimes**: Cloudflare Workers, Bun, Deno, Node.js
- **Migration strategy**: Replace Node.js streams with Web Streams API
- **Use case**: Enable webhook-triggered CMS publishing in edge environments

### Adding New Pipeline
1. Extend base pipeline pattern in `services/gilbert/lib/`
2. Implement `prep()` and `build()` methods
3. Register in main Gilbert class (`index.js`)
4. **Use Web Streams** for new pipeline implementations

### Debugging Streams
- Use `Utils.streamLog()` for stream event debugging
- Check `options.cwd` is always "/" for virtual filesystem consistency
- Verify file paths are properly resolved via `path.resolve()`

### Publishing Packages
```bash
# Publish dependency first
cd services/gilbert-file && npm publish
cd ../gilbert && npm publish  
cd ../gilbert-cli && npm publish
```

Always maintain version compatibility between workspace packages when publishing.

## Additional AI Prompts

**Primary Documentation**: The main `docs/developer-guide.md` serves both humans and AI agents with unified documentation patterns using AI-specific callouts.

**Specialized Prompts**: For task-specific guidance, check the `docs/.prompts/` folder:
- `architecture.md` - Deep dive into pipeline architecture and stream processing
- `performance.md` - Performance optimization patterns and benchmarking
- Task templates for common development scenarios

This project follows a docs-as-code philosophy where AI instructions evolve alongside engineering documentation to ensure they stay current with each commit.
