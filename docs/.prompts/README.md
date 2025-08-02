# AI Prompts Directory

This directory contains specialized AI prompts that complement the main documentation. The project follows a docs-as-code philosophy where AI instructions evolve alongside the codebase.

## Structure

### Persistent Prompts

Long-lived architectural guidance that stays relevant across development cycles:

- `architecture.md` - Deep dive into streams, pipelines, and virtual filesystem
- `performance.md` - Patterns for maintaining 200+ pages/second target
- `migration.md` - Web Streams migration guidance

### Task Templates

Reusable prompt templates for common development tasks:

- `refactor-pipeline.md` - Template for pipeline refactoring
- `debug-streams.md` - Debugging stream processing issues
- `add-feature.md` - Adding new functionality

### Active Task

- `active-task.md` - Current work context (gitignored/ephemeral)

## Usage Pattern

1. Use persistent prompts for general architectural context
2. Copy/customize task templates for specific work
3. Update active-task.md with current focus
4. Include only relevant prompts to manage token usage

## Integration

The main `developer-guide.md` is designed to serve both humans and AI agents using unified documentation patterns with AI-specific callouts.

**Code Style**: See the Code Style & Formatting section in `unified-developer-guide-template.md` for ESLint and Prettier configuration details.
