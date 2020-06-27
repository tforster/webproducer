/* eslint-disable no-restricted-syntax */
("use strict");

// System dependencies (Built in modules)
const { finished } = require("stream");

// Third party dependencies (Typically found in public NPM packages)
const cleanCSS = require("gulp-clean-css");
const minifyHtml = require("gulp-htmlmin");
const sourcemaps = require("gulp-sourcemaps");
const terser = require("gulp-terser");
const vfs = require("vinyl-fs");

// Project dependencies
const config = require("./Config");
const GraphQLDataProvider = require("./GraphQLDataProvider");
const Utils = require("./Utils");
const vs3 = require("./Vinyl-s3");
const VHandlebars = require("./Vinyl-Handlebars");
const vzip = require("./Vinyl-zip");

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

    // set the configuration after parsing the config YAML or file pointing to YAML
    try {
      this.config = config(configPathOrString)
    }
    catch (err) {
      // If we don't have config there's no point in continuing
      console.error("Exiting")
      throw err;
    }

    // Check that a stage value was provided.
    if (!this.config.stage) {
      throw new Error("The stage is not defined");
    }

    // Get configuration of the source and destination folders (could local, S3, etc)
    this.src = Utils.vinylise(this.config.templateSource);
    this.dest = Utils.vinylise(this.config.destination);

    // ToDo: Rename to something provider agnostic
    this.datoCMSToken = this.config.dataSource.token;
    this.preview = this.config.preview;
  }


  /**
   * Entry point into WebProducer
   * @memberof WebProducer
   */
  async main() {
    const config = this.config;
    const vhandlebars = new VHandlebars();

    // Clear the destination ready to receive new files. We do not currently support synchronisation or merging to destination.
    if (config.destination.type === "s3") {
      // Destination variable references an S3 bucket
      // ToDo: Consider a way of emptying or synchronising destination buckets
    } else {
      // Destination variable references a filesystem path
      await Utils.emptyDirectories(this.dest.path);
    }

    // Point the source stream to either S3 (vs3) or the local filesystem (vfs)
    // ToDo: Refactor Vinyl-S3 to use the factory pattern so we don't have to re-instance it. Then it can be used interchangeably with vfs.
    // Initialise a variable that will point to either a VinylS3 or VinylFS object
    let sourceStream;

    if (this.src.type === "s3") {
      // Stream from AWS S3
      sourceStream = new vs3(this.src);
    } else {
      // Stream from the local filesystem
      sourceStream = vfs;
    }
    // Template source is expected to be in a stage specific and lower cased subfolder, eg, /dev, /stage or /prod
    const srcRoot = this.src.base;

    console.log("profile", "before data");

    try {
      // Parallelise fetching data from API, precompiling templates and all from async stream reading
      var [siteData, _] = await Promise.all([
        // We use /db/**/* since we already constructed the S3 Stream with s3://bucket/src/{stage}
        await GraphQLDataProvider.data(sourceStream.src(`${srcRoot}/db/**/*`), config),
        vhandlebars.precompile(sourceStream.src(`${srcRoot}/theme/**/*.hbs`)),
      ]);
      // Quick check to ensure we have actual data to work with
      if (!siteData || Object.entries(siteData).length === 0) {
        throw new Error("No data provided");
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
    console.log("profile", "after data");

    // Promise.all above resolved with data and precompiled templates from different sources so now we can generate pages.
    const pages = await vhandlebars.build(siteData);
    console.log("profile", "after build");

    // ToDo: vs3 below should become a variable that can point to either vfs or vs3
    // e.g. const stream = vs3(options.templateSource) || vfs(options.templateSource)

    const streamsToMerge = [
      // Add all files to the stream other than those in folders we are specifically interacting with
      sourceStream.src(
        [
          `${srcRoot}/**/*.*`,
          `!${srcRoot}/db/**`,
          `!${srcRoot}/scripts/**`,
          `!${srcRoot}/stylesheets/**`,
          `!${srcRoot}/theme/**`,
        ]
      ),

      // Minify JavaScript files and add to the stream
      sourceStream
        .src(`${srcRoot}/scripts/**/*.js`, "stage/scripts/")
        .pipe(terser())
        .pipe(sourcemaps.write("/")),
      // Minify CSS files and add to the stream
      sourceStream
        .src(`${srcRoot}/stylesheets/**/*.css`, "stage/stylesheets/")
        .pipe(sourcemaps.init())
        .pipe(cleanCSS())
        .pipe(sourcemaps.write("/")),
      // Minify HTML files and add to the stream
      pages.stream.pipe(minifyHtml({ collapseWhitespace: true, removeComments: true })),
    ];

    console.log("profile", "after merge");

    // Set the destinationStream to either a VinylFS or Vinyl-S3 stream
    const destinationStream = this.dest.type === "s3"
      ? new vs3(config.destination).dest(config.destination.Bucket)
      : vfs.dest(this.dest.path);

    destinationStream.on("error", (err) => {
      console.error(err);
      throw err;
    });

    // Aggregate all source streams into the destination stream, with optional intermediate zipping
    await Promise.all(
      streamsToMerge.map(
        // Promisify each Readable Vinyl stream
        async (source) =>
          new Promise((resolve, reject) => {
            // Set success and failure handlers
            source.on("end", () => {
              console.log("profile", "merge ended");
              return resolve();
            });

            // Set failure handlers
            source.on("error", (err) => {
              console.error("MERGE:", err);
              return reject(err);
            });

            // Account for possible zipping of contents
            if (config.archiveDestination) {
              // Merge streams into a zip file before piping to the destination
              source.pipe(vzip.zip()).pipe(destinationStream, { end: false });
            } else {
              // Merge streams directly to the destination
              try {
                source.pipe(destinationStream, { end: false });
              } catch (err) {
                console.error(err);

              }
            }
          })
      )
    );

    finished(destinationStream, (err) => {
      if (err) {
        console.error("destinationStream errored:", err);
      }
    });

  }
}

module.exports = WebProducer;
