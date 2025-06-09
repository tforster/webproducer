# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) and [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

- All releases are available as [GitHub Releases](https://github.com/tforster/webproducer/releases).

This repository uses [workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces) for managing multiple packages.  
Each workspace/package maintains its own `CHANGELOG.md` for package-specific changes.

- [services/gilbert/CHANGELOG.md](./services/gilbert/CHANGELOG.md)
- [services/gilbert-cli/CHANGELOG.md](./services/gilbert-cli/CHANGELOG.md)
- [services/gilbert-file/CHANGELOG.md](./services/gilbert-file/CHANGELOG.md)

## [v1.0.0-beta.5](https://github.com/tforster/webproducer/compare/v1.0.0-beta.4...v1.0.0-beta.5) - 2025-06-09

### Changed

- This release sees the shift in the NPM registry from WebProducer to gilbert.
- NPM workspaces are now being used to manage the gilbert CLI and gilbert file packages.

### Removed

- The Gilbert CLI has been removed for now. It will be reintroduced in a future release with a more robust architecture and an easier to use interface.

## [v1.0.0-beta.4](https://github.com/tforster/webproducer/compare/v1.0.0-beta.3...v1.0.0-beta.4) - 2025-01-17

## [v1.0.0-beta.3](https://github.com/tforster/webproducer/compare/v1.0.0-beta.2...v1.0.0-beta.3) - 2024-10-01

## [v1.0.0-beta.2](https://github.com/tforster/webproducer/compare/v1.0.0-beta.1...v1.0.0-beta.2) - 2024-06-01

### Fixed

- Reversed change from v1.0.0-beta.1 which was an erroneous issue.
- Bumped all dependencies and devDependencies to latest, except for vinyl\* that have breaking changes.
- Removed annoying console.log() lines

## [v1.0.0-beta.1](https://github.com/tforster/webproducer/compare/v1.0.0-beta.0...v1.0.0-beta.1) - 2023

### Fixed

- Minor bugfix to Utils.js to correct an issue where virtual files in the pipeline inherited the path of the parent project as their base. This caused files to be generated into the destination folder with the full path of the project appended.

## [v1.0.0-beta.0](https://github.com/tforster/webproducer/compare/v1.0.0...v1.0.0-beta.0) - 2022-05-18

### Added

- First NPM registry release of the new architecture.

## [v1.0.0] - 2024-xx-xx

### Changed

- Complete overhaul and ground-up re-architecture of WebProducer with performance and reusability in mind.
- Core is much leaner (just 6 dependencies), expects (mostly) readable streams for input and provides a single writable stream as output.
- CLI utility provided: `npx @tforster/webproducer`.
- Pipelines can be selectively enabled/disabled for flexible usage.

---

<!-- Legacy history below, reformatted for consistency -->

## [v0.9.0] - 2021-04-05

### Added

- Support JS and CSS file bundling ([#334](https://dev.azure.com/techsmarts/TechSmarts/_workitems/edit/334))

### Fixed

- Published env variable logic is flipped ([#762](https://dev.azure.com/techsmarts/TechSmarts/_workitems/edit/762))

## [v0.8.0] - 2020-12-13

### Changed

- Remove references to transform.js in documentation ([#830](https://dev.azure.com/techsmarts/TechSmarts/_workitems/edit/830))
- Refactor index.js and DataSource.js to accept the new Transform module capability ([#831](https://dev.azure.com/techsmarts/TechSmarts/_workitems/edit/831))

## [v0.7.2] - 2020-11-15

### Fixed

- CloudFront invalidations are "too" strict ([#743](https://dev.azure.com/techsmarts/TechSmarts/_workitems/edit/743))

## [v0.7.1] - 2020-08-09

### Breaking

- Data and data/meta paths are now expected to be in the root of the templates path for both FS and S3.
- The path parameter in webproducer.yml has been renamed to base.

### Fixed

- Regression issue means local data.json files are not found ([#735](https://dev.azure.com/techsmarts/Web%20Producer/_workitems/edit/735))

## [v0.7.0] - 2020-08-01

### Changed

- Separated non-HTML files from HTML minifier. Non-HTML files are no longer minified.

## [v0.6.0] - 2020-07-26

### Breaking

- Format of webproducer.yml has changed.
- Index.js now assumes src/data vs former src/db.

### Added

- Supports snapshot option to persist data.
- Supports debugTransform option.
- Index.js constructor now supports string or object values for data, templates and destination.
- Added a projicon to root.
- DataSource class has placeholders for future get (REST), sql and mongo sources.

### Fixed

- Fixed issue in Config.js where environment variables were only expanded if they were at the end of string.

## [v0.5.1] - 2020-07-21

### Fixed

- Fixes issue where VinylS3 src was not creating the .path and .base properties properly.
- Fixes issue whereby scripts and css were not being moved to the root.

## [v0.5.0] - 2020-07-05

### Added

- Support for S3+CloudFront as a deployable target.
- Switched to a new YAML based configuration strategy.
- Deployments now copy new and changed files only.

## [v0.4.0] - 2020-05-24

### Changed

- Migrated the repository from Azure DevOps repos to GitHub.

## [v0.3.0] - 2020-03-26

### Changed

- Streams support was refactored to improve both stability and performance.

## [v0.2.0] - 2020-02-19

### Fixed

- Numerous minor issues were resolved after using WebProducer for the first time as a dependency of a real project.

## [v0.1.0] - 2020-01-07

### Added

- Git repository created and proof-of-concept code added to /src directory.

[Unreleased]: https://github.com/tforster/webproducer/compare/v1.0.0-beta.2...HEAD
[v1.0.0-beta.2]: https://github.com/tforster/webproducer/compare/v1.0.0-beta.1...v1.0.0-beta.2
[v1.0.0-beta.1]: https://github.com/tforster/webproducer/compare/v1.0.0-beta.0...v1.0.0-beta.1
[v1.0.0-beta.0]: https://github.com/tforster/webproducer/compare/v1.0.0...v1.0.0-beta.0
[v1.0.0]: https://github.com/tforster/webproducer/releases/tag/v1.0.0
