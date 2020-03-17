/* eslint-disable no-restricted-syntax */
("use strict");

// System dependencies (Built in modules)
const path = require("path");

// Third party dependencies (Typically found in public NPM packages)
const cleanCSS = require("gulp-clean-css");
const minifyHtml = require("gulp-htmlmin");
const sourcemaps = require("gulp-sourcemaps");
const terser = require("gulp-terser");
const vfs = require("vinyl-fs");

// Project dependencies
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
  constructor(options) {
    // Set console.log and console.error functionality
    WebProducer._setLogging(options.logLevel);
    this.options = options;

    // Check that a stage value was provided.
    if (!this.options.stage) {
      throw new Error("The stage is not defined");
    }

    //this.templateSource = this._vinylesque(options.templateSource);
    this.destination = this._vinylesque(options.destination);

    // Optional user function to further shape data retrieved from CMS source
    this.transformFunction = options.transformFunction;
    // Name of S3 bucket to upload this.dist contents to
    this.amplify = options.amplify;
    // Additional AWS options, including ./aws/credentials profile
    this.aws = options.aws;
    // READ-ONLY token to access CMS
    this.datoCMSToken = options.datoCMSToken;
    // Amplify appId
    this.appId = options.appId;
    // Determine whether to use draft or published data
    this.preview = options.preview;
    // Initialise the Handlebars helper class
    //this.hb = new HandlebarsHelper();
  }

  /**
   * Parses the supplied metaData string into a Vinyl-like structure that can be used with the Vinyl constructor later
   * @param {string} metaData:  An S3 URL, or an absolute path, or a relative path
   * @returns:                  A lean object that can be used in a Vinyl file constructor with additional properties
   * @memberof WebProducer
   */
  _vinylesque(metaData) {
    let vinylesque = {};

    if (typeof metaData === "object") {
      // Assume an S3 object
      vinylesque = { ...metaData };
      vinylesque.path = metaData.key || "";
    } else {
      // Assume a file path string
      vinylesque.path = path.resolve(metaData);
    }
    // Calculate the Vinyl base.
    // ToDo: Determine if this is needed when we create legit Vinyl file
    vinylesque.base = path.dirname(vinylesque.path);

    // Use RegEx to determine if last path segment is a filename (at least one "." must be present)
    const matches = vinylesque.path.match(/\/[^.^\/]*$/g);
    if (matches) {
      // Is a directory
      vinylesque.stat = { mode: 16384 };
    } else {
      // Is a file
      vinylesque.stat = { mode: 32768 };
      vinylesque.filename = path.basename(vinylesque.path);
    }

    return vinylesque;
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
        console.log = () => {};
        break;
      default:
        // Show nothing
        console.error = () => {};
        console.log = () => {};
    }
  }

  /**
   * Entry point into WebProducer
   * @memberof WebProducer
   */
  async main() {
    console.time("profile");
    console.timeLog("profile", "starting");
    const options = this.options;
    const vhandlebars = new VHandlebars();

    // Clear the destination ready to receive new files. We do not currently support synchronisation or merging to destination.
    if (options.destination.Bucket) {
      // Destination variable references an S3 bucket
      // ToDo: Consider a way of emptying or synchronising destination buckets
    } else {
      // Destination variable references a filesystem path
      await Utils.emptyDirectories(options.destination);
    }

    // Point the source stream to either S3 (vs3) or the local filesystem (vfs)
    // ToDo: Refactor Vinyl-S3 to use the factory pattern so we don't have to re-instance it. Then it can be used interchangeably with vfs.
    if (options.templateSource.Bucket) {
      // Stream from AWS S3
      //var sourceStream = new vs3(options.templateSource);
      var sourceStream = new vs3(options.templateSource);
      var tempPrefix = options.stage;
    } else {
      // Stream from the local filesystem
      var sourceStream = vfs; //.dest(options.templateSource);
      var tempPrefix = options.templateSource;
    }

    console.timeLog("profile", "before data");

    try {
      // Parallelise fetching data from API, precompiling templates and all from async stream reading
      var [siteData, _] = await Promise.all([
        await GraphQLDataProvider.data(sourceStream.src([`${tempPrefix}/db/**/*`]), options),
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
    console.timeLog("profile", "after data");

    // Promise.all above resolved with data and precompiled templates from different sources so now we can generate pages.
    const pages = await vhandlebars.build(siteData);
    console.timeLog("profile", "after build");

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
    console.timeLog("profile", "after merge");
    // determine whether to pipe to a zip file ahead of an S3 deploy, or our local filesystem
    const destinationType = this.destination.Bucket ? "remote" : "local";

    if (destinationType === "local") {
      var destinationStream = vfs.dest(options.destination);
    } else {
      var destinationStream = new vs3(options.destination).dest(options.destination.Bucket);
    }

    //const destinationStream = vamplify.dest(options);

    // // Add a finish handler
    destinationStream.on("finish", async () => {
      console.timeLog("profile", "after destination stream finish");
      console.log("Distribution finished");

      if (options.amplifyDeploy) {
        // Call the Amplify deploy endpoint which is API asynchnronous!
        // ToDo: Determine how to follow deploy progress and report back to here. Currently deploy is fire-and-forget!!
        await vamplify.deploy(
          {
            appId: options.appId,
            stage: options.stage,
            // Note that Amplify is not available in all regions yet, including ca-central-1. Force to us-east-1 for now.
            aws: {
              Bucket: options.amplifyDeploy.Bucket,
              key: options.amplifyDeploy.key,
              bucketRegion: options.amplifyDeploy.region,
              amplifyRegion: "us-east-1",
            },
          },
          destinationStream
        );
        console.log("Amplify startDeployment finished.");
      }
    });

    // Aggregate all source streams into the destination stream, with optional intermediate zipping
    await Promise.all(
      streamsToMerge.map(
        // Promisify each vfs readable stream
        async (source) =>
          new Promise((resolve, reject) => {
            // Set success and failure handlers
            source.on("end", () => {
              resolve();
            });

            // Set failure handlers
            source.on("error", (err) => {
              console.error("MERGE:", err);
              reject(err);
            });

            // Account for possible zipping of contents
            if (options.archiveDestination) {
              // Merge streams into a zip file before piping to the destination
              source.pipe(vzip.zip()).pipe(destinationStream, { end: false });
            } else {
              // Merge streams directly to the destination
              source.pipe(destinationStream, { end: false });
            }
          })
      )
    );
    console.timeLog("profile", "after PRomise all");
    // // All Promises have been fulfilled so now we can end() the stream
    destinationStream.end();
  }
}

module.exports = WebProducer;
