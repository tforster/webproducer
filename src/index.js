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
const Amplify = require("./Amplify");
const GraphQLDataProvider = require("./GraphQLDataProvider");
const Utils = require("./Utils");
const HandlebarsHelper = require("./HandlebarsHelper");
const vs3 = require("./Vinyl-s3");
const vzip = require("./Vinyl-zip");

/**
 * Website and web-app agnostic class implementing a "build" process that merges handlebars templates with GraphQL data to produce
 * static output.
 * Note that the Lambda runtime filesystem is read-only with the exception of the /tmp directory..
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

    console.log("WebProducer.constructor:", options, process.env);
    // Stage as in AWS Lambda definition of stage
    this.stage = options.stage || "dev";

    if (this.stage === "dev") {
      // Force loggin on and write output to relative dist folder
      WebProducer._setLogging("ALL");
      console.log("Stage configured for development.");
    }

    // Configure the templates source and destination objects (can be S3 or local filesystem or combo)
    this.templateSource = this._vinylesque(options.templateSource);
    this.destination = this._vinylesque(options.destination);

    // The templateCache is the actual pointer to the local filesystem to find the template files
    this.templateCache = path.resolve(this.templateSource.Bucket ? "/tmp/src" : this.templateSource.path);

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
      vinylesque.path = metaData.Key || "";
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
   * Wrapper around our module that fetches data from DatoCMS
   * @memberof WebProducer
   * @returns {Promise}:  Data from CMS
   */
  async _fetchData(queryPath, preview) {
    const graphQLOptions = {
      query: queryPath,
      endpoint: "https://graphql.datocms.com/",
      transform: this.transformFunction,
      token: this.datoCMSToken,
    };

    // .data returns a Promise
    try {
      return await GraphQLDataProvider.data(graphQLOptions, preview);
    } catch (err) {
      console.error("_fetchData():", err);
      throw err;
    }
  }

  /**
   * Wrapper around our Amplify module wrapper around AWS Amplify API for deploying
   * @param {string} appId: The AWS Amplify application Id
   * @param {string} stage: The Lambda-like stage (one of dev, stage or prod)
   * @param {object} aws:   AWS properties including bucket, key and region
   * @returns {Promise}:    Status as a string
   * @memberof WebProducer
   */
  async _deploy(appId, stage, amplify) {
    return Amplify.deploy({
      appId,
      stage,
      // Note that Amplify is not available in all regions yet, including ca-central-1. Force to us-east-1 for now.
      aws: { Bucket: amplify.Bucket, key: amplify.key, bucketRegion: amplify.region, amplifyRegion: "us-east-1" },
    });
  }

  async _fetchTemplatesFromS3() {
    console.time("Fetch templates from S3");
    return new Promise(async (resolve, reject) => {
      // Empty the temporary directory first
      await Utils.emptyDirectories(this.templateCache);

      // Create a VinylS3 stream
      const s3Stream = new vs3(this.templateSource);
      s3Stream.on("end", () => resolve());
      // Start piping
      s3Stream.pipe(vfs.dest(this.templateCache)).on("finish", () => {
        console.timeEnd("Fetch templates from S3", "DONE");
      });
    });
  }

  /**
   * Entry point into WebProducer
   * @memberof WebProducer
   */
  async main() {
    console.time("WebProducer", "start");

    // Do some filesystem preparation
    // | property    | offline | online |
    // |-------------|---------|--------|
    // | local       | true    |        |
    // | aws         |         | true   |
    // | s3-source   | true    | true   |
    // | s3-dest     | true    | true   |
    // | file-source | true    | false  |
    // | file-dest   | true    | false  |

    // If templateSource has a Bucket property then it describes a remote S3 bucket and we need to get its contents locally
    if (this.templateSource.Bucket) {
      console.log("hello world");
      console.timeLog("WebProducer", "in s3");
      await this._fetchTemplatesFromS3();
    }
    console.timeLog("WebProducer", "out s3");
    if (this.destination.Bucket) {
      // ToDo: Consider a way of emptying or synchronising destination buckets
    } else {
      // Destination is a filesytem so empty the destination subdirectory
      await Utils.emptyDirectories(this.destination.path);
    }

    // Initialise the Handlebars helper class
    const hb = new HandlebarsHelper();

    // The following two activities can run in parallel but we ONLY NEED siteData at resolution
    const [siteData] = await Promise.all([
      // Fetch data from DatoCMS (GraphQL)
      this._fetchData(path.join(this.templateCache, "db/query.graphql"), this.preview),
      // Precompile all the handlebars files in src/theme
      hb.precompile([path.join(this.templateCache, "theme/organisms"), path.join(this.templateCache, "theme/templates")]),
    ]).catch((reason) => {
      console.error("WP:Main.sitedata", reason);
      throw reason;
    });

    if (!siteData || siteData === {}) {
      throw new Error("No data provided");
    }

    // Generate pages by combining the templates precompiled above and the data, also fetched above
    const pages = await hb.build(siteData);

    // Certain directories in src will require pre-processing and should not be copied to the destination raw
    const blackList = [
      `!${path.join(this.templateCache, "db/**")}`,
      `!${path.join(this.templateCache, "scripts/**")}`,
      `!${path.join(this.templateCache, "stylesheets/**")}`,
      `!${path.join(this.templateCache, "theme/**")}`,
    ];

    // Create an array of stream reader sources to eventually pass to a single stream writer
    const streams = [
      // Copy all of the src tree, minus black listed globs
      vfs.src([path.join(this.templateCache, "**/*.*"), ...blackList]),
      // Copy scripts after first minifying them
      vfs
        .src(path.join(this.templateCache, "scripts/**/*.js"))
        .pipe(sourcemaps.init())
        .pipe(terser())
        .pipe(sourcemaps.write("/")),
      // Copy css files after first minifying them
      vfs
        .src(path.join(this.templateCache, "stylesheets/**/*.css"))
        .pipe(sourcemaps.init())
        .pipe(cleanCSS())
        .pipe(sourcemaps.write("/")),
      // Copy pages after first minifying them
      pages.stream.pipe(minifyHtml({ collapseWhitespace: true, removeComments: true })),
    ];

    // determine whether to pipe to a zip file ahead of an S3 deploy, or our local filesystem
    const destinationStream = this.destination.Bucket ? vzip.zip() : vfs.dest(this.destination.path);

    // Aggregate all source streams into tmpStream
    await Promise.all(
      // Promisify each vfs readable stream
      streams.map(
        async (source) =>
          new Promise((resolve, reject) => {
            // Set success and failure handlers
            source.on("end", () => {
              resolve();
            });
            source.on("error", (err) => {
              console.error(err);
              reject(err);
            });
            // Start piping using {end: false} to ensure the writeable stream remains open for the next readable stream
            source.pipe(destinationStream, { end: false });
          })
      )
    );

    // Deployment steps here
    if (this.destination.Bucket) {
      console.log("WP:main.deploy");
      // The destinationStream has one more stream, S3, to write to
      destinationStream.pipe(new vs3(this.destination));
      //await this._deploy(this.appId, this.stage, this.amplify);
      await Amplify.deploy({
        appId: this.appId,
        stage: this.stage,
        // Note that Amplify is not available in all regions yet, including ca-central-1. Force to us-east-1 for now.
        aws: { Bucket: this.amplify.Bucket, key: this.amplify.key, bucketRegion: this.amplify.region, amplifyRegion: "us-east-1" },
      });
    }
    // No more processing required so close everything down
    destinationStream.end();

    console.timeEnd("WebProducer");
  }
}

module.exports = WebProducer;
