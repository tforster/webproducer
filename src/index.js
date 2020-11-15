/* eslint-disable no-restricted-syntax */
("use strict");

// Third party dependencies (Typically found in public NPM packages)
const cleanCSS = require("gulp-clean-css");
const minifyHtml = require("gulp-htmlmin");
const sourcemaps = require("gulp-sourcemaps");
const terser = require("gulp-terser");
const vfs = require("vinyl-fs");

// Project dependencies
const CloudFront = require("./CloudFront");
const Config = require("./Config");
const DataSource = require("./DataSource");
const MergeStream = require("./MergeStream");
const StreamUtils = require("./StreamUtils");
const Utils = require("./Utils");
const vs3 = require("./S3FileAdapter");
const PageBuilder = require("./PageBuilder");

/**
 * Website and web-app agnostic class implementing a "build" process that merges handlebars templates with JSON data to produce
 * static output.
 * @class WebProducer
 */
class WebProducer {
  /**
   *Creates an instance of WebProducer.
   * @param {string} configPathOrString:  String of YAML or path to a YAML file containing configuration settings
   * @memberof WebProducer
   */
  constructor(configPathOrString) {
    this.startTime = new Date();
    console.log(`${new Date().toISOString()}> WebProducer started`);

    // set the configuration after parsing the config YAML or file pointing to YAML
    try {
      this.config = Config.getConfig(configPathOrString);
    } catch (err) {
      // If we don't have config there's no point in continuing
      throw new Error("Could not find any configuration");
    }

    // Vinylise the template data
    if (typeof this.config.templates === "string") {
      // Deserialise config.data from an alias
      this.config.templates = this.config[this.config.templates];
    }
    this.src = Utils.vinylise(this.config.templates);
    console.log(`${new Date().toISOString()}> Templates:   ${this.config.templates.base}`);

    // Vinylise the destination data
    if (typeof this.config.destination === "string") {
      // Deserialise config.data from an alias
      this.config.destination = this.config[this.config.destination];
    }
    this.dest = Utils.vinylise(this.config.destination);
    console.log(`${new Date().toISOString()}> Destination: ${this.config.destination.base}`);

    // Setup data object describing data and meta sources
    this.data = this._getDataSource(this.config.templates);
    console.log(
      `${new Date().toISOString()}> Data:        ${
        this.data.endpoint ? this.data.endpoint.base + "/data" : this.data.path + "/data"
      }`
    );
    console.log(`${new Date().toISOString()}> Meta:        ${this.data.path + "/data/meta"}`);
  }

  /**
   * @returns {object}:       A definition of the data and meta sources including any properties necessary to access S3, FS, GQL...
   * @memberof WebProducer
   */
  _getDataSource(templates) {
    const config = this.config;

    // Data default path and meta always come from templates location. E.g. /data and /data/meta
    const dataSource = {
      type: templates.type,
      path: templates.base,
      region: templates.region,
    };

    // If config.data is specified then it must be an endpoint such as GraphQL or REST
    if (config.data) {
      // First, deserialise config.data is an alias to an actual config.data object
      if (typeof config.data === "string") {
        // Deserialise config.data from an alias
        config.data = config[config.data];
      }
      dataSource.endpoint = config.data;
      //dataSource.endpoint = config.data;
    }

    return dataSource;
  }

  /**
   * Determines and instantiates the correct Vinyl FS or S3 stream objects to handle input and output
   * @returns {object}: An object containing the source and destination stream objects
   * @memberof WebProducer
   */
  _prepareStreams() {
    // Set the sourceStream to either a VinylFS or Vinyl-S3 stream
    const srcStreamReadable = this.src.type === "s3" ? new vs3(this.src) : vfs;

    // Set the readable and writable destination streams to either a VinylFS or Vinyl-S3 stream
    let destStreamWritable;
    // Read the contents of the destination pre-deployment so we can calculate a diff and only deploy changed files
    let destStreamReadable;

    if (this.dest.type === "s3") {
      destStreamWritable = vs3.dest(this.dest);
      destStreamReadable = new vs3(this.dest).src(this.dest.path + "**/*", true); // Remember, S3 doesn't use a leading slash
    } else {
      destStreamWritable = vfs.dest(this.dest.path);
      destStreamReadable = vfs.src(this.dest.path + "/**/*");
    }

    // Return the three streams ready for use
    return { srcStreamReadable, destStreamWritable, destStreamReadable };
  }

  /**
   * Entry point into WebProducer
   *
   * @param {object} options: Additional options typically passed at runtime to temporarily alter the behaviour of WebProducer
   *                          - debugTransform: Enable breakpoint debugging in transform.js
   *                          - dataSnapshot:   Save retrieved data to the current data meta path as data.json
   * @memberof WebProducer
   */
  async main(options) {
    // Shortcut to access config
    const config = this.config;

    // Set debugTransform true to be passed into dynamically loaded Transform module to enable breakpoint debugging
    this.data.debugTransform = options.debugTransform;
    // Set snapshot true to save the retrieved data (usually via GraphQL) to the current data meta path
    this.data.snapshot = options.snapshot;

    // Instantiate various classes
    const pageBuilder = new PageBuilder();
    const streamUtils = new StreamUtils();

    // Setup the FS and/or S3 streams for retrieving and uploading content
    const { srcStreamReadable, destStreamWritable, destStreamReadable } = this._prepareStreams();

    // Start getting file meta from dest as a Promise that can be deferred until after the build process
    const destinationFilesParsed = streamUtils.parseDestinationFiles(destStreamReadable);

    // Template source is expected to be in a stage specific and lower cased subfolder, eg, /dev, /stage or /prod
    const srcRoot = this.src.base;

    try {
      // Parallelise fetching data from API, precompiling templates and all from async stream reading
      var [siteData, _] = await Promise.all([
        // Wait for our data source to return from any remote retrieval, database queries and transformations
        await DataSource.data(this.data),
        // Precompile all .hbs templates into the vhandlebars object from the stream
        pageBuilder.precompile(srcStreamReadable.src(`${srcRoot}/theme/**/*.hbs`)),
      ]);
    } catch (err) {
      console.error(err);
    }
    // Quick check to ensure we have actual data to work with
    if (!siteData || Object.entries(siteData).length === 0) {
      throw new Error("No data provided");
    }

    // Promise.all above resolved with data and precompiled templates from different sources so now we can generate pages.
    const { htmlStream, fileStream, pages, redirects, files } = await pageBuilder.build(siteData);
    fileStream.name = "fileStream";
    // Merge our streams containing loose files, concatenated scripts, concatenated css and generated HTML into one main stream

    // TODO: Make name a parameter than can be passed in on the .src() method for cleaner code here. Has to work with vFS and vS3.

    // Loose files are all non-transformable resources like fonts, robots.txt, etc. Note that we ignore db, scripts, theme, etc.
    const looseFiles = srcStreamReadable.src([
      `${srcRoot}/**/*.*`,
      `!${srcRoot}/data/**`,
      `!${srcRoot}/scripts/**`,
      `!${srcRoot}/stylesheets/**`,
      `!${srcRoot}/theme/**`,
    ]);
    looseFiles.name = "looseFiles";

    // We ignored scripts above as they require unique handling
    const scripts = srcStreamReadable.src(`${srcRoot}/scripts/**/*.js`).pipe(terser()).pipe(sourcemaps.write("/"));
    scripts.name = "scripts";

    // We ignored stylesheets above as they require unique handling
    const stylesheets = srcStreamReadable
      .src(`${srcRoot}/stylesheets/**/*.css`)
      .pipe(sourcemaps.init())
      .pipe(cleanCSS())
      .pipe(sourcemaps.write("/"));
    stylesheets.name = "stylesheets";

    // We ignored the stream of handlebars theme files as they were generated earlier and require additional unique handling here
    const pagesStream = htmlStream.pipe(minifyHtml({ collapseWhitespace: true, removeComments: true }));
    pagesStream.name = "pagesStream";

    // Promise for parsing destination files deferred to last moment here to allow for async processing. Note that S3 is a long time
    await destinationFilesParsed;

    // Merge all the various input streams into one main stream to be parsed
    const streams = [looseFiles, scripts, stylesheets, pagesStream, fileStream];

    // MergedStream is new in 0.5.0 and replaces the previous and more complicated Promise-based code block
    const mergedStream = new MergeStream(streams);

    // Don't move beyond this next block until we know everything hasa been written to the destination
    await new Promise((resolve) => {
      // filterDeployableFiles() compares built files to ETags of existing files to determine the change delta to actually deploy.
      mergedStream.pipe(streamUtils.filterDeployableFiles()).pipe(destStreamWritable);

      destStreamWritable.on("finish", async () => {
        console.log(`${new Date().toISOString()}> Finished deploying new and updated files.`);
        resolve();
      });
    });

    // We want to invalidate ASAP and the risk of the few extra ms here vs deleting files no longer required is ok
    if (config.destination.cloudFrontDistributionId && streamUtils.destinationUpdates) {
      // CloudFront requires "/" rooted paths, whereas our paths are not "/" rooted elsewhere in this system
      streamUtils.destinationUpdates = streamUtils.destinationUpdates.map((path) => `/${path}`);

      const retval = await CloudFront.createInvalidation({
        distributionId: config.destination.cloudFrontDistributionId,
        paths: streamUtils.destinationUpdates,
        region: this.dest.region,
      });
      console.log(`${new Date().toISOString()}> Requested CloudFront invalidation: ${retval.Id}.`);
    }

    // delete files
    // TODO: Implement filesystem agnostic deletion class/method. Consider a branched stream?
    const endTime = new Date();

    console.log(
      `${new Date().toISOString()}> WebProducer built and deployed: ${pages} pages, ${redirects} redirects and ${files} files in ${
        endTime - this.startTime
      }ms.`
    );
  }
}

module.exports = WebProducer;
