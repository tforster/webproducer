/* eslint-disable no-restricted-syntax */
("use strict");

// System dependencies (Built in modules)
//const { finished, Writable } = require("stream");

// Third party dependencies (Typically found in public NPM packages)
const cleanCSS = require("gulp-clean-css");
const minifyHtml = require("gulp-htmlmin");
const sourcemaps = require("gulp-sourcemaps");
const terser = require("gulp-terser");
const vfs = require("vinyl-fs");

// Project dependencies
const CloudFront = require("./CloudFront");
const config = require("./Config");
const GraphQLDataProvider = require("./GraphQLDataProvider");
const MergeStream = require("./MergeStream");
const Utils = require("./Utils");
const vs3 = require("./Vinyl-s3");
const VHandlebars = require("./Vinyl-Handlebars");
const vzip = require("./Vinyl-zip");
const Metafy = require("./Metafy");

/**
 * Website and web-app agnostic class implementing a "build" process that merges handlebars templates with GraphQL data to produce
 * static output.
 * @class WebProducer
 */
class WebProducer {
  /**
   *Creates an instance of Build.
   * @param {object} options: Runtime options passed in from project implementation
   * @memberof WebProducer
   */
  constructor(configPathOrString) {
    this.startTime = new Date();
    console.log(`>>> WebProducer started at ${this.startTime.toISOString()}`);
    // set the configuration after parsing the config YAML or file pointing to YAML
    try {
      this.config = config(configPathOrString);
    } catch (err) {
      // If we don't have config there's no point in continuing
      console.error("Exiting");
      throw err;
    }

    // Get configuration of the source and destination folders (could local, S3, etc)
    this.src = Utils.vinylise(this.config.templateSource);
    this.dest = Utils.vinylise(this.config.destination);
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
    let destStreamReadable; // Used to evaluate existing destination to determine which files to update

    if (this.dest.type === "s3") {
      destStreamWritable = vs3.dest(this.dest);
      const z = new vs3(this.dest);
      destStreamReadable = z.src(this.dest.path + "**/*"); // Remember, S3 doesn't use a leading slash
    } else {
      destStreamWritable = vfs.dest(this.dest.path);
      destStreamReadable = vfs.src(this.dest.path + "/**/*");
    }

    return { srcStreamReadable, destStreamWritable, destStreamReadable };
  }

  /**
   * Entry point into WebProducer
   * @memberof WebProducer
   */
  async main() {
    const config = this.config;
    const vhandlebars = new VHandlebars();
    const metafy = new Metafy();

    // Setup the FS and/or S3 streams for retrieving and uploading content
    const { srcStreamReadable, destStreamWritable, destStreamReadable } = this._prepareStreams();

    // Start getting file meta from dest as a Promise that can be deferred until after the build process
    const destinationFilesParsed = metafy.parseDestinationFiles(destStreamReadable);
    //const k = await destinationFilesParsed;
    // Template source is expected to be in a stage specific and lower cased subfolder, eg, /dev, /stage or /prod
    const srcRoot = this.src.base;

    try {
      // Parallelise fetching data from API, precompiling templates and all from async stream reading
      var [siteData, _] = await Promise.all([
        // We use /db/**/* since we already constructed the S3 Stream with s3://bucket/src/{stage}
        await GraphQLDataProvider.data(srcStreamReadable.src(`${srcRoot}/db/**/*`), config),
        vhandlebars.precompile(srcStreamReadable.src(`${srcRoot}/theme/**/*.hbs`)),
      ]);
      // Quick check to ensure we have actual data to work with
      if (!siteData || Object.entries(siteData).length === 0) {
        throw new Error("No data provided");
      }
    } catch (err) {
      console.error(err);
      throw err;
    }

    // Promise.all above resolved with data and precompiled templates from different sources so now we can generate pages.
    const pages = await vhandlebars.build(siteData);

    // Merge our streams containing loose files, concatenated scripts, concatenated css and generated HTML into one main stream
    const looseFiles = srcStreamReadable.src([
      `${srcRoot}/**/*.*`,
      `!${srcRoot}/db/**`,
      `!${srcRoot}/scripts/**`,
      `!${srcRoot}/stylesheets/**`,
      `!${srcRoot}/theme/**`,
    ]);
    looseFiles.name = "looseFiles";

    const scripts = srcStreamReadable.src(`${srcRoot}/scripts/**/*.js`).pipe(terser()).pipe(sourcemaps.write("/"));
    scripts.name = "scripts";

    const stylesheets = srcStreamReadable
      .src(`${srcRoot}/stylesheets/**/*.css`)
      .pipe(sourcemaps.init())
      .pipe(cleanCSS())
      .pipe(sourcemaps.write("/"));
    stylesheets.name = "stylesheets";

    const pagesStream = pages.stream.pipe(minifyHtml({ collapseWhitespace: true, removeComments: true }));
    pagesStream.name = "pagesStream";

    await destinationFilesParsed;
    const streams = [looseFiles, scripts, stylesheets, pagesStream];

    const mergedStream = MergeStream(looseFiles, scripts, stylesheets, pagesStream);

    // Wait for the merged files to be prepared and deployed

    await new Promise((resolve, reject) => {
      mergedStream.pipe(metafy.filterDeployableFiles()).pipe(destStreamWritable);

      destStreamWritable.on("finish", async () => {
        console.log(">>> Finished deploying new and updated files.");
        resolve();
      });
    });

    // We want to invalidate ASAP and the risk of the few extra ms here vs deleting files no longer required is ok
    if (config.destination.webserver && config.destination.webserver.cloudFrontDistributionId) {
      // CloudFront requires "/" rooted paths, whereas our paths are not "/" rooted elsewhere in this system
      metafy.destinationUpdates = metafy.destinationUpdates.map((path) => `/${path}`);

      const retval = await CloudFront.createInvalidation({
        distributionId: config.destination.webserver.cloudFrontDistributionId,
        paths: metafy.destinationUpdates,
        region: this.dest.region,
      });
      console.log(`>>> Requested CloudFront invalidation: ${retval.Id}.`);
    }

    // delete files
    // TODO: Implement filesystem agnostic deletion class/method. Consider a branched stream?
    const endTime = new Date();
    console.log(`>>> WebProduced finished at ${endTime.toISOString()} (${endTime - this.startTime}ms).`);
  }
}

module.exports = WebProducer;
