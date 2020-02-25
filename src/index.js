/* eslint-disable no-restricted-syntax */
("use strict");

// System dependencies (Built in modules)
//const fs = require("fs").promises;
const path = require("path");
const fsp = require("fs").promises;
const fs = require("fs");

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
const VMove = require("./Vinyl-move");
const vs3 = require("./Vinyl-s3");
const vsitemap = require("./Vinyl-sitemap");
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

    // Construct output paths. Un supplied tmpDirectory requires additional timestamp suffix for uniqueness
    if (process.env.IS_OFFLINE !== "true") {
      // In AWS environment Lambda functions are re-entrant (aka warm start) so we need a suffix to support multiple instances
      const t = new Date().getMilliseconds();
      this.build = path.resolve(`/tmp/build-${t}`);
      this.dest = path.resolve(`/tmp/dist-${t}`);
    } else {
      // Means we are running local dev and not real AWS environment
      this.build = path.resolve("../tmp/build");
      this.dest = path.resolve("../tmp/dist");
    }

    // Optional user function to further shape data retrieved from CMS source
    this.transformFunction = options.transformFunction;
    // Name of S3 bucket to upload this.dist contents to
    this.amplifyBucket = options.amplifyBucket;
    // Additional AWS options, including ./aws/credentials profile
    this.aws = options.aws;
    // READ-ONLY token to access CMS
    this.datoCMSToken = options.datoCMSToken;
    // Amplify appId
    this.appId = options.appId;
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
  async _fetchData() {
    const graphQLOptions = {
      query: "./stack/db/query.graphql",
      endpoint: "https://graphql.datocms.com/",
      transform: this.transformFunction,
      token: this.datoCMSToken,
    };

    // .data returns a Promise
    return GraphQLDataProvider.data(graphQLOptions);
  }

  /**
   * Wrapper around our Amplify module wrapper around AWS Amplify API for deploying
   * @param {string} appId: The AWS Amplify application Id
   * @param {string} stage: The Lambda-like stage (one of dev, stage or prod)
   * @param {object} aws:   AWS properties including bucket, key and region
   * @returns {Promise}:    Status as a string
   * @memberof WebProducer
   */
  async _deploy(appId, stage, aws) {
    return Amplify.deploy({
      appId,
      stage,
      // Note that Amplify is not available in all regions yet, including ca-central-1. Force to us-east-1 for now.
      aws: { bucket: aws.bucket, key: aws.key, bucketRegion: aws.region, amplifyRegion: "us-east-1" },
    });
  }

  async main() {
    const now = new Date().getTime();
    const stage = this.stage;
    const hb = new HandlebarsHelper();

    // Empty our distribution directory. Required for local dev only! Stage/prod use pure streams.
    if (stage === "dev") {
      await Utils.emptyDirectories("./tmp/dist");
    }

    // The following two activities can run in parallel but we ONLY NEED siteData at resolution
    const [siteData] = await Promise.all([
      // Fetch data from DatoCMS (GraphQL)
      this._fetchData(),
      // Precompile all the handlebars files in src/theme
      hb.precompile(["./stack/theme/organisms", "./stack/theme/templates"]),
    ]).catch((reason) => {
      console.error(reason);
    });

    // Generate pages by combining the templates precompiled above and the data, also fetched above
    const pages = await hb.build(siteData);

    // Certain directories in src will require pre-processing and should not be copied to the destination raw
    const blackList = ["!./stack/db/**", "!./stack/scripts/**", "!./stack/stylesheets/**", "!./stack/theme/**"];

    // Create an array of stream reader sources to eventually pass to a single stream writer
    const streams = [
      // Copy all of the src tree, minus black listed globs
      vfs.src(["./stack/**/*.*", ...blackList]),
      // Copy scripts after first minifying them
      vfs
        .src("./stack/scripts/**/*.js")
        .pipe(sourcemaps.init())
        .pipe(terser())
        .pipe(sourcemaps.write("/")),
      // Copy css files after first minifying them
      vfs
        .src("./stack/stylesheets/**/*.css")
        .pipe(sourcemaps.init())
        .pipe(cleanCSS())
        .pipe(sourcemaps.write("/")),
      // Copy pages after first minifying them
      pages.stream.pipe(minifyHtml({ collapseWhitespace: true, removeComments: true })),
    ];

    // Dev writes to the local file system via VFS while stage and prod write to a Zip stream
    const destinationStream = stage !== "dev" ? vzip.zip() : vfs.dest("./tmp/dist");

    // Aggregate all source streams into tmpStream
    await Promise.all(
      // Promisify each vfs readable stream
      streams.map(
        async (source) =>
          new Promise((resolve, reject) => {
            // Set success and failure handlers
            source.on("end", () => {
              console.log("end", source);
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

    if (stage !== "dev") {
      // The destinationStream has one more stream, S3, to write to
      destinationStream.pipe(new vs3(this.aws));
      await this._deploy(this.appId, this.stage, this.aws);
    }
    // No more processing required so close everything down
    destinationStream.end();

    console.log(`Elapsed time: ${new Date().getTime() - now}ms`);
  }
}

module.exports = WebProducer;
