# Change Log  <!-- omit in toc -->

_A detailed history of project versions and associated release notes._

- This project uses **Semantic Versioning 2.0.0**. Please see [SemVer](https://semver.org/) to read the specification.
- All released versions are available as [Releases on this repository](https://github.com/tforster/webproducer/releases).

## Table of Contents <!-- omit in toc -->

- [v1.0.0 **WebProducer as a Module**](#v100-webproducer-as-a-module)
- [v0.9.0 **Support JS and CSS file bundling** (2021-04-05)](#v090-support-js-and-css-file-bundling-2021-04-05)
- [v0.8.0 **Shift transform logic from transform.js to Transform module** (2020-12-13)](#v080-shift-transform-logic-from-transformjs-to-transform-module-2020-12-13)
- [v0.7.2 **Fixes CloudFront not invalidating issue** (2020-11-15)](#v072-fixes-cloudfront-not-invalidating-issue-2020-11-15)
- [v0.7.1 **Fixes the meta vs path issue** (2020-08-09)](#v071-fixes-the-meta-vs-path-issue-2020-08-09)
- [v0.7.0 **Separated non-HTML files from HTML minifier** (2020-08-01)](#v070-separated-non-html-files-from-html-minifier-2020-08-01)
- [v0.6.0 **Static JSON Files** (2020-07-26)](#v060-static-json-files-2020-07-26)
- [v0.5.1 **Fixes issue whereby scripts and css were not being moved to the root** (2020-07-21)](#v051-fixes-issue-whereby-scripts-and-css-were-not-being-moved-to-the-root-2020-07-21)
- [v0.5.0 **S3+CloudFront** (2020-07-05)](#v050-s3cloudfront-2020-07-05)
- [v0.4.0 **Switched repository** (2020-05-24)](#v040-switched-repository-2020-05-24)
- [v0.3.0 **Improve stream stability** (2020-03-26)](#v030-improve-stream-stability-2020-03-26)
- [v0.2.0 **First-use updates** (2020-02-19)](#v020-first-use-updates-2020-02-19)
- [v0.1.0 **Initial creation** (2020-01-07)](#v010-initial-creation-2020-01-07)
  
## v1.0.0 **WebProducer as a Module**

This release represents a complete overhaul and ground-up re-architecture of WebProducer with performance and reusability in mind.

The WebProducer core is much leaner (just 6 dependencies) expecting (mostly) readable streams for input and providing a single writeable stream as output. This makes it trivial to add WebProducer as a dependency to another project. To demonstrate this, a CLI utility aimed at developers is provided that can be run by simply typing `npx @tforster/webproducer` in the root of web project.

In superficial testing on an 8th Gen i7 (Dell XPS-13) the CLI was able to generate a complete website with a dozen pages, numerous images, bundle and tree-shake ES modules, bundle CSS and minify everything including the HTML in ~400 ms. The total output was 147 files totalling 15 Mb.

The new WebProducer uses pipelines to handle different tasks, merging the output of each to a single stream. The pipelines can be selectively turned on and off as required making WebProducer an ideal development tool (enable all pipelines) as well as a perfect serverless page builder (enable just the templating pipeline).

## v0.9.0 **Support JS and CSS file bundling** (2021-04-05)

Features

- [Support JS and CSS file bundling](https://dev.azure.com/techsmarts/TechSmarts/_workitems/edit/334)
Fixes

- [Published env variable logic is flipped](https://dev.azure.com/techsmarts/TechSmarts/_workitems/edit/762)

## v0.8.0 **Shift transform logic from transform.js to Transform module** (2020-12-13)

- [Remove references to transform.js in documentation](https://dev.azure.com/techsmarts/TechSmarts/_workitems/edit/830)
- [Refactor index.js and DataSource.js to accept the new Transform module capability](https://dev.azure.com/techsmarts/TechSmarts/_workitems/edit/831)

## v0.7.2 **Fixes CloudFront not invalidating issue** (2020-11-15)

- [CloudFront invalidations are "too" strict](https://dev.azure.com/techsmarts/TechSmarts/_workitems/edit/743)
  
## v0.7.1 **Fixes the meta vs path issue** (2020-08-09)

Breaking changes:

- The data and data/meta paths are now expected to be in the root of the templates path for both FS and S3. Specifying a datasource in webproducer.yml for file based sources is no longer required. Datasource are only necessary for GraphQL.
- The path parameter in webproducer.yml has been renamed to base to make it easier to add path snippets for include/exclude globs (coming soon). Note base over root since it is an established convention with the Vinyl specification that is used by WebProducer.
- See the [README](README.md) for an example of the latest webproducer.yml syntax.

Fixes:

- [`735: Regression issue means local data.json files are not found`](https://dev.azure.com/techsmarts/Web%20Producer/_workitems/edit/735)

## v0.7.0 **Separated non-HTML files from HTML minifier** (2020-08-01)

- non-HTML files such as robots.txt, sitemap.xml and feed.xml were being sent through the HTML minifier along with regular HTML files with unexpected results. This has feature bump sees the separation of HTML and non-HTML before HTML minification occurs. Note that non-HTML files are _not_ minified at all now.

## v0.6.0 **Static JSON Files** (2020-07-26)

Breaking changes:

- The format of webproducer.yml has changed. See the latest [README](README.md).
- Index.js now assumes src/data vs former src/db. The former db directory will need to be renamed to data.

Features:

- Supports snapshot option to persist data.
- Supports debugTransform option to enable breakpoint debugging of the external transform module.
- Index.js constructor now supports string or object values for data, templates and destination.
- Added a projicon to root.
- DataSource class has placeholders for future get (REST), sql and mongo sources.

Fixes:

- Fixed issue in Config.js where environment variables were only expanded if they were at the end of string.

## v0.5.1 **Fixes issue whereby scripts and css were not being moved to the root** (2020-07-21)

- Fixes issue where VinylS3 src was not creating the .path and .base properties properly.

## v0.5.0 **S3+CloudFront** (2020-07-05)

- Added support for S3+CloudFront as a deployable target
- Switched to a new YAML based configuration strategy
- Deployments now copy new and changed files only

## v0.4.0 **Switched repository** (2020-05-24)

Migrated the repository from Azure DevOps repos to GitHub.

## v0.3.0 **Improve stream stability** (2020-03-26)

Streams support was refactored to improve both stability and performance.

## v0.2.0 **First-use updates** (2020-02-19)

Numerous minor issues were resolved after using WebProducer for the first time as a dependency of a real project.

## v0.1.0 **Initial creation** (2020-01-07)

Git repository created and proof-of-concept code added to /src directory.
