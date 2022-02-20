# WebProducer <!-- omit in toc -->

WebProducer is a data-driven tool for highly performant production of websites and web applications.

## Table of Contents <!-- omit in toc -->

- [About](#about)
- [Try It Out](#try-it-out)
- [Usage](#usage)
  - [Installation](#installation)
  - [Operation](#operation)
    - [Path Overrides](#path-overrides)
    - [Additional CSS Options](#additional-css-options)
    - [Disable Pipelines](#disable-pipelines)
    - [Housekeeping Options](#housekeeping-options)
  - [Default Directory Structure](#default-directory-structure)
- [API](#api)
- [Change Log](#change-log)
- [Code of Conduct](#code-of-conduct)
- [Contributing](#contributing)
- [Meta](#meta)

## About

While WebProducer could be thought of as static site generator it differs in that it is:

- **Data-driven**: Whereas most static site generators process a tree of page-centric markdown files in the filesystem, WebProducer takes a stream of data and generates content by merging it with in-memory "component" templates. This approach allows WebProducer to be extremely fast and efficient for building content with complex IA needs.
- **Streams based**: It makes heavy use of readable, writeable and transformation streams allowing for large volumes of content to be processed at high speed with minimal memory requirements. This also makes WebProducer ideal for serverless deployments using AWS Lambda or Azure Cloud Functions.
  
  Since WebProducer consumes and produces streams its behaviour can be easily adapted by transforming the inbound data with a pipe and transforming the outbound data with a pipe. For instance, data could be streamed from a REST API call to a transformation function that restructures the data schema before piping on to WebProducer.
- **Decoupled architecture**: The core of WebProducer is implemented as a reusable NPM module. Since it only accepts and returns streams it can be leveraged for uses cases including:
  - Local web development: It can build a 200+ page site with minified HTML, bundled and minified ES modules, and bundled and minified CSS in well under a second in a moderate workstation
  - Serverless web publishing: Triggered by a webhook from a headless CMS a WebProducer serverless function can query a data endpoint (REST, GraphQL, etc), rebuild and redeploy pages to a production server in about a second.
- **Lean and Lightweight**: Requiring just 6 dependencies WebProducer's at-rest and in-memory footprint is very small.
- **Uses Handlebars Templates**: Although Handlebars has been around for a long time it is still significantly faster than &lt;insert bloaty framework du jour here>. And, the Handlebars token replacement syntax means it can be used to generate files of many types including HTML, CSS, JS, text, XML, etc. This makes it easy to generate all files in a website including robots.txt, sitemap.xml, manifest.json, etc.

For a detailed technical explanation please see the [Developer Guide](./docs/developer-guide.md).

## Try It Out

1. Clone this repo `git clone git@github.com:tforster/webproducer.git`
2. CD into the project: `cd webproducer`
3. Install dependencies: `npm i`
4. CD into the examples/sample-site directory: `cd examples/getting-started`
5. Run the CLI: `npx webproducer`
6. Review the output in examples/getting-started/dist

## Usage

### Installation

Technically the WebProducer CLI requires no installation as it can be run using npx. However, installing it as a developer dependency will reduce the loading latency.

``` shell
npm install @tforster/webproducer --save-dev
```

### Operation

``` shell
npx webproducer [options]
```

WebProducer can run nicely out-of-the-box against an appropriately [structured source tree](#default-directory-structure) it also has lots of configuration options for fine tuning. These can be viewed anytime by typing `npx webproducer -h` which produces the following:

``` shell
  -V, --version               output the version number
  -r, --relative-root [root]  The relative root of all the source files (default: "./src")
  -d, --data [data]           Path to the JSON data file. (default: "./src/data/data.json")
  -t, --theme [theme]         Glob to handlebars files (default: "./src/theme/**/*.hbs")
  -s, --scripts [scripts]     Comma separated list of ES Module entry points (default: "./src/scripts/main.js")
  -c, --css [css]             Comma separated list of stylesheet entry points (default: "./src/stylesheets/main.css")
  -f, --files [files]         Comma separated list of static file globs (default: "./src/images/**/*.*")
  -o, --out [out]             Output directory (default: "./dist")
  -x, --prefix-css            Enable autoprefixing of CSS (default: false)
  --no-scripts                Do not process scripts
  --no-css                    Do not process stylesheets
  --no-files                  Do not process files
  --no-pages                  Do not process pages
  -h, --help                  display help for command
```

#### Path Overrides

WebProducer provides defaults for all paths that follow the Joy naming structure developers are free to override as required to suit their particular directory conventions.

- **-r, --relative-root**: The relative root of all the source files (default: "./src")
- **-d, --data**: Path to the JSON data file. (default: "./src/data/data.json")
- **-t, --theme**: Glob to handlebars files (default: "./src/theme/**/*.hbs")
- **-s, --scripts**: Comma separated list of ES Module entry points -(default: "./src/scripts/main.js")
- **-c, --css**: Comma separated list of stylesheet entry points -(default: "./src/stylesheets/main.css")
- **-f, --files**: Comma separated list of static file globs (default: "./src/images/**/*.*")
- **-o, --out**: Output directory (default: "./dist")

#### Additional CSS Options

- **-x, --prefix-css**: Enable vendor prefixes of CSS (default: false). If newer and/or experimental CSS features are used then enabling CSS prefixing with `--prefix-css` will use the data based on current browser popularity and property support to apply prefixes.

  _Note: This is accomplished with [PostCSS's](https://postcss.org/) [Autoprefixer](https://github.com/postcss/autoprefixer) which calls out to the [Can I Use](https://caniuse.com/) website. The extra overhead does increase WebProducer execution time so you may wish to defer this until you are building a release version._

#### Disable Pipelines

While WebProducer is already very fast, the various `--no-*` switches can be used to disable specific pipelines for even more speed. For instance, you may be focusing on template development and not actively editing JS and CSS. In which case adding `--no-scripts --no-css` would disable those pipelines, leaving the last state of generated script and CSS in place in the out directory.

- **--no-scripts**: Disables the scripts pipeline. No scripts will be parsed or written to the output stream.
- **--no-css**: Disables the stylesheets pipeline. No stylesheets will be parsed or written to the output stream.
- **--no-files**: Disables the static files pipeline that copies assets from source. No static files will be parsed or written to the output stream.
- **--no-pages**: Disables the templates pipeline. No template driven files will be parsed or written to the output stream.

#### Housekeeping Options

A couple of options to help get the most out of WebProducer.

- **-h, --help**: Get a summary of all available options at any time
- **-V, --version**: Output the current version of the WebProducer CLI

### Default Directory Structure

WebProducer expects source files to be found in the following tree structure by default, but they can be overridden using various CLI flags.

``` shell
. (your project root)
└── src
    ├── data
    ├── fonts
    ├── images
    ├── scripts
    ├── stylesheets
    └── theme
        ├── common
        └── templates
```

## API

See how easy WebProducer's simple streams API is with [Use Remote REST API to Create XML files on S3](./examples/use-remote-rest-api-to-create-xml-files-on-s3/README.md). Or check out the [examples](./examples/README.md) directory for others.

Full API details are coming in the [Developer Guide](/docs/developer-guide.md).

## Change Log

See [CHANGELOG.md](./CHANGELOG.md) for more information.

## Code of Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for more information.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## Meta

Troy Forster – @tforster – troy.forster@gmail.com

See [LICENSE](./LICENSE.txt) for more information.

<https://github.com/tforster/webproducer>
