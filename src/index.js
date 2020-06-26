/* eslint-disable no-restricted-syntax */
("use strict");

// System dependencies (Built in modules)
const { finished } = require("stream");
const path = require("path");

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
const vamplify = require("./Vinyl-Amplify");
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
  constructor(options, configPathOrString) {

    // set the configuration after parsing the config YAML or file pointing to YAML
    try {
      this.config = config(configPathOrString)
    }
    catch (err) {
      // If we don't have config there's no point in continuing
      console.error("Exiting")
      throw err;
    }

    // Set console.log and console.error functionality
    WebProducer._setLogging(this.config.logLevel);
    //this.options = options;

    // Check that a stage value was provided.
    if (!this.config.stage) {
      throw new Error("The stage is not defined");
    }

    this.destination = this._vinylize(this.config.destination);
    this.config.src = this._vinylize(this.config.templateSource);
    // Name of S3 bucket to upload this.dist contents to
    //this.amplify = options.amplify;
    // Additional AWS options, including ./aws/credentials profile
    //this.aws = options.aws;
    // READ-ONLY token to access CMS

    // ToDo: Rename to something provider agnostic
    this.datoCMSToken = this.config.dataSource.token;

    // Amplify appId
    //this.appId = options.appId;
    // Determine whether to use draft or published data
    this.preview = this.config.preview;
    // Initialise the Handlebars helper class
    //this.hb = new HandlebarsHelper();
  }

  /**
   * Parses the supplied metaData string into a Vinyl-like structure that can be used with the Vinyl constructor later
   * @param {string} metaData:  An S3 URL, or an absolute path, or a relative path
   * @returns:                  A lean object that can be used in a Vinyl file constructor with additional properties
   * @memberof WebProducer
   */
  _vinylize(metaData) {
    let vinylize = {
      type: metaData.type,
      path: metaData.path.toLowerCase()
    };


    // if (typeof metaData === "object") {
    //   // Assume an S3 object
    //   vinylize = { ...metaData };
    //   vinylize.path = metaData.key || "";
    // } else {
    //   // Assume a file path string
    //   vinylize.path = path.resolve(metaData);
    // }

    switch (vinylize.type) {
      case "graphql":
        break;
      case "s3":
        vinylize.region = metaData.region;
        const u = new URL(vinylize.path);
        vinylize.bucket = u.host;
        vinylize.path = u.pathname;
        break;
      case "filesystem":
        vinylize.path = path.resolve(vinylize.path);
        break;
      default:
    }

    // Calculate the Vinyl base.
    // ToDo: Determine if this is needed when we create legit Vinyl file
    //vinylize.base = path.dirname(vinylize.path);
    // Setting to path for now since S3 from Yaml should be specifiying that
    vinylize.base = vinylize.path;

    // Use RegEx to determine if last path segment is a filename (at least one "." must be present)
    const matches = vinylize.path.match(/\/[^.^\/]*$/g);
    if (matches) {
      // Is a directory
      vinylize.stat = { mode: 16384 };
    } else {
      // Is a file
      vinylize.stat = { mode: 32768 };
      vinylize.filename = path.basename(vinylize.path);
    }

    return vinylize;
  }

  /**
   * Takes advantage of the global nature of console methods to manage logging verbosity to CloudWatch (receiver of stdOut and stdErr)
   * @static
   * @param {*} logLevel
   * @memberof WebProducer
   */
  static _setLogging(logLevel) {
    // Prevent WP from writing to stdOut, stdErr, etc as it is a blocking synchronous operation and also fills up CloudWatch
    const verbosity = (logLevel || "none").toLowerCase();
    switch (verbosity) {
      case "all":
        // Show logs and errors
        break;
      case "errors":
        // Show errors
        console.log = () => { };
        break;
      default:
        // Show nothing
        console.error = () => { };
        console.log = () => { };
    }
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
      await Utils.emptyDirectories(config.destination.path);
    }

    // Point the source stream to either S3 (vs3) or the local filesystem (vfs)
    // ToDo: Refactor Vinyl-S3 to use the factory pattern so we don't have to re-instance it. Then it can be used interchangeably with vfs.
    // Initialise a variable that will point to either a VinylS3 or VinylFS object
    let sourceStream;
    if (config.src.type === "s3") {
      // Stream from AWS S3
      sourceStream = new vs3(config.src);

    } else {
      // Stream from the local filesystem
      sourceStream = vfs;
      //      var tempPrefix = config.templateSource;
    }
    // Template source is expected to be in a stage specific and lower cased subfolder, eg, /dev, /stage or /prod
    var tempPrefix = config.src.base;
    tempPrefix = "src/stage"

    console.log("profile", "before data");

    try {
      // Parallelise fetching data from API, precompiling templates and all from async stream reading
      var [siteData, _] = await Promise.all([
        await GraphQLDataProvider.data(sourceStream.src([`${tempPrefix}/db/**/*`]), config),
        vhandlebars.precompile(sourceStream.src(`${tempPrefix}/theme/**/*.hbs`)),
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
          `${tempPrefix}/**/*.*`,
          `!${tempPrefix}/db/**`,
          `!${tempPrefix}/scripts/**`,
          `!${tempPrefix}/stylesheets/**`,
          `!${tempPrefix}/theme/**`,
        ],
        "stage/"
      ),
      // Minify JavaScript files and add to the stream
      sourceStream
        .src(`${tempPrefix}/scripts/**/*.js`, "stage/scripts/")
        .pipe(terser())
        .pipe(sourcemaps.write("/")),
      // Minify CSS files and add to the stream
      sourceStream
        .src(`${tempPrefix}/stylesheets/**/*.css`, "stage/stylesheets/")
        .pipe(sourcemaps.init())
        .pipe(cleanCSS())
        .pipe(sourcemaps.write("/")),
      // Minify HTML files and add to the stream
      pages.stream.pipe(minifyHtml({ collapseWhitespace: true, removeComments: true })),
    ];

    console.log("profile", "after merge");

    // Set the destinationStream to either a VinylFS or Vinyl-S3 stream
    const destinationStream = this.destination.Bucket
      ? new vs3(config.destination).dest(config.destination.Bucket)
      : vfs.dest(config.destination);

    // Aggregate all source streams into the destination stream, with optional intermediate zipping
    await Promise.all(
      streamsToMerge.map(
        // Promisify each Readable Vinyl stream
        async (source) =>
          new Promise((resolve, reject) => {
            // Set success and failure handlers
            source.on("end", () => {
              console.log("profile", "merge ended");
              resolve();
            });

            // Set failure handlers
            source.on("error", (err) => {
              console.error("MERGE:", err);
              reject(err);
            });

            // Account for possible zipping of contents
            if (config.archiveDestination) {
              // Merge streams into a zip file before piping to the destination
              source.pipe(vzip.zip()).pipe(destinationStream, { end: false });
            } else {
              // Merge streams directly to the destination
              source.pipe(destinationStream, { end: false });
            }
          })
      )
    );

    finished(destinationStream, (err) => {
      if (err) {
        console.error("destinationStream errored:", err);
      }
    });

    // Should we also deploy to Amplify?
    if (config.amplifyDeploy) {
      console.log("profile", "amplifyDeploy starting");
      // Call the Amplify deploy endpoint which is API asynchnronous!
      // ToDo: Determine how to follow deploy progress and report back to here. Currently deploy is fire-and-forget!!
      const deployDetails = await vamplify.deploy(
        {
          appId: config.appId,
          stage: config.stage,
          // Note that Amplify is not available in all regions yet, including ca-central-1. Force to us-east-1 for now.
          aws: {
            Bucket: config.amplifyDeploy.Bucket,
            key: config.amplifyDeploy.key,
            bucketRegion: config.amplifyDeploy.region,
            amplifyRegion: "us-east-1",
          },
        },
        destinationStream
      );

      console.log("Amplify deployment job:", deployDetails);
    }
  }
}

module.exports = WebProducer;
