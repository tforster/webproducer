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
const GraphQLDataProvider = require("./GraphQLDataProvider");
const MergeStream = require("./MergeStream");
const StreamUtils = require("./StreamUtils");
const Utils = require("./Utils");
const vs3 = require("./Vinyl-s3");
const PageBuilder = require("./PageBuilder");

/**
 * Website and web-app agnostic class implementing a "build" process that merges handlebars templates with GraphQL data to produce
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
    console.log(`>>> WebProducer started at ${this.startTime.toISOString()}`);

    // set the configuration after parsing the config YAML or file pointing to YAML
    try {
      this.config = Config.getConfig(configPathOrString);
    } catch (err) {
      // If we don't have config there's no point in continuing
      throw new Error("Could not find any configuration");
    }

    // Get configuration for the data source
    if (typeof this.config.data === "string") {
      this.data = this.config[this.config.data];
    } else {
      this.data = this.config.data;
    }
    console.log(`>>> data: ${this.data.path}`);

    // Get configuration for the template source
    if (typeof this.config.templates === "string") {
      this.src = Utils.vinylise(this.config[this.config.templates]);
    } else {
      this.src = Utils.vinylise(this.config.templates);
    }
    console.log(`>>> src:  ${this.src.path}`);

    // Get configuration for the destination source
    if (typeof this.config.destination === "string") {
      this.dest = Utils.vinylise(this.config[this.config.destination]);
    } else {
      this.dest = Utils.vinylise(this.config.destination);
    }

    console.log(`>>> dest: ${this.dest.path || this.dest.bucket || "n/a"}`);
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
   * @memberof WebProducer
   */
  async main() {
    // Shortcut to access config
    const config = this.config;
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
        // Wait for our GraphQL data that in turn needs to wait for the contents of graphql.query and transform.js
        //await GraphQLDataProvider.data(srcStreamReadable.src(`${srcRoot}/db/**/*`), config),
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
    const pages = await pageBuilder.build(siteData);

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
    const pagesStream = pages.stream.pipe(minifyHtml({ collapseWhitespace: true, removeComments: true }));
    pagesStream.name = "pagesStream";

    // Promise for parsing destination files deferred to last moment here to allow for async processing. Note that S3 is a long time
    await destinationFilesParsed;

    // Merge all the various input streams into one main stream to be parsed
    const streams = [looseFiles, scripts, stylesheets, pagesStream];

    // MergedStream is new in 0.5.0 and replaces the previous and more complicated Promise-based code block
    const mergedStream = new MergeStream(streams);

    // Don't move beyond this next block until we know everything hasa been written to the destination
    await new Promise((resolve, reject) => {
      // filterDeployableFiles() compares built files to ETags of existing files to determine the change delta to actually deploy.
      mergedStream.pipe(streamUtils.filterDeployableFiles()).pipe(destStreamWritable);

      destStreamWritable.on("finish", async () => {
        console.log(">>> Finished deploying new and updated files.");
        resolve();
      });
    });

    // We want to invalidate ASAP and the risk of the few extra ms here vs deleting files no longer required is ok
    if (config.destination.webserver && config.destination.webserver.cloudFrontDistributionId && streamUtils.destinationUpdates) {
      // CloudFront requires "/" rooted paths, whereas our paths are not "/" rooted elsewhere in this system
      streamUtils.destinationUpdates = streamUtils.destinationUpdates.map((path) => `/${path}`);

      const retval = await CloudFront.createInvalidation({
        distributionId: config.destination.webserver.cloudFrontDistributionId,
        paths: streamUtils.destinationUpdates,
        region: this.dest.region,
      });
      console.log(`>>> Requested CloudFront invalidation: ${retval.Id}.`);
    }

    // delete files
    // TODO: Implement filesystem agnostic deletion class/method. Consider a branched stream?
    const endTime = new Date();

    console.log(
      `>>> WebProducer built and deployed ${pages.pages} pages and ${pages.redirects} redirects at ${endTime.toISOString()} (${
      endTime - this.startTime
      }ms).`
    );
  }
}

module.exports = WebProducer;
