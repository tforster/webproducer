/* eslint-disable no-restricted-syntax */
("use strict");

// System dependencies (Built in modules)
const fs = require("fs").promises;
const path = require("path");

// Third party dependencies (Typically found in public NPM packages)
const minifyCss = require("gulp-minify-css");
const minifyHtml = require("gulp-htmlmin");
const minifyJs = require("gulp-terser");
const rev = require("gulp-rev");
const usemin = require("gulp-usemin");
const vfs = require("vinyl-fs");

// Project dependencies
const Amplify = require("./Amplify");
const GraphQLDataProvider = require("./GraphQLDataProvider");
const Utils = require("./Utils");
const Handlebars = require("./HandlebarsHelper");
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
    // Stage as in AWS Lambda definition of stage
    this.stage = options.stage || "dev";

    // In AWS environment Lambda functions are re-entrant (aka warm start) so we need a suffix to support multiple instances
    const t = new Date().getMilliseconds();

    // Construct output paths. Un supplied tmpDirectory requires additional timestamp suffix for uniqueness
    this.build = options.tmpDirectory ? path.resolve(`${options.tmpDirectory}/build`) : `/tmp/build-${t}`;
    this.dest = options.tmpDirectory ? path.resolve(`${options.tmpDirectory}/dist`) : `/tmp/dist-${t}`;

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
    this.cache = this.cache || { cache: {} };
  }

  /**
   * Copies static files and folders, including images, scripts, css, etc, from resources to root of dist.
   * @memberof WebProducer
   * @returns {Promise string}:    Text status
   */
  _copyResources(dest) {
    return new Promise((resolve, reject) => {
      vfs
        .src(`./resources/**/*.*`)
        .on("error", (err) => reject(err))
        .on("end", function() {
          resolve("resources copied");
        })
        .pipe(vfs.dest(dest));
    });
  }

  /**
   * Minifies and concatenates HTML, CSS and JavaScript. Also cache busts the minified CSS and JS files before creating and
   * uploading a zip file to AWS S3.
   * @memberof WebProducer
   * @returns {Promise}:  Status as a string
   */
  async _createDistribution() {
    const fnStart = new Date();
    const aws = this.aws;

    return new Promise((resolve, reject) => {
      vfs
        .src(`${this.build}/**/*.html`)
        .on("error", (e) => reject())
        .pipe(
          usemin({
            path: this.build,
            outputRelativePath: ".",
            css: [() => minifyCss(), () => rev()],
            html: [() => minifyHtml({ collapseWhitespace: true, removeComments: true })],
            js: [() => minifyJs(), () => rev()],
          })
        )
        .pipe(vzip.zip("archive.zip"))
        .pipe(vs3.dest(null, { aws: { bucket: aws.bucket, key: aws.key, region: aws.region } }))
        .on("finish", () => resolve(`Distribution created and uploaded to S3 in ${new Date() - fnStart}ms`));
    });
  }

  /**
   * Wrapper around our module that fetches data from DatoCMS
   * @memberof WebProducer
   * @returns {Promise}:  Data from CMS
   */
  async _fetchData() {
    const graphQLOptions = {
      query: "./db/query.graphql",
      endpoint: "https://graphql.datocms.com/",
      transform: this.transformFunction,
      token: this.datoCMSToken,
    };

    // .data returns a Promise
    return GraphQLDataProvider.data(graphQLOptions);
  }

  /**
   * Wrapper around our Handlebars module wrapper to pre-compile templates
   * @returns {Promise}:  An instance of Handlebars with .partials and .templates populated
   * @memberof WebProducer
   */
  async _compileTemplates(pathsArray) {
    return Handlebars.precompile(pathsArray);
  }

  /**
   * Wrapper around our empty directory utility method
   * @returns {Promise}:  Currently null/undefined
   * @memberof WebProducer
   */
  async _emptyDirectories() {
    return Utils.emptyDirectories([this.build, this.dest]);
  }

  /**
   * Combines data with templates to produce HTML, XML and RSS files
   * @param {object} data:      Monolithic (currently) structure containing all data required by all templates
   * @param {object} templates: Previously compiled Handlebars templates
   * @returns {Promise}:        Status as a string
   * @memberof WebProducer
   */
  async _buildPages(data, templates) {
    // Iterate all available data elements (note: one per "page")
    for (const key in data) {
      // Isolate the current data element
      const fields = data[key];
      // Merge the data element with the template indicated in the data elements _modelApiKey property (required)
      const result = templates[`${fields._modelApiKey}.hbs`](fields);
      // Calculate the full relative path to the output file
      const filePath = path.join(this.build, key);
      // Ensure the calculated path exists by force creating it. Nb: Cheaper to force it each time than to cycle through {fs.exists, then, fs.mkdir}
      await fs.mkdir(path.parse(filePath).dir, { recursive: true });
      // Write the result to the filesystem at the filePath
      await fs.writeFile(filePath, result, { encoding: "utf8" });
    }
    // Return a Promise of the status
    return Promise.resolve("pages built");
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

  /**
   * @memberof WebProducer
   */
  async main() {
    const start = new Date();
    const stage = this.stage;

    // 1. Await the preparation of the environment, fetch data and initialise handlebars
    const [emptyDirectories, siteData, handlebars] = await Promise.all([
      this._emptyDirectories(),
      this._fetchData(),
      this._compileTemplates(["./theme/organisms", "./theme/templates"]),
    ]).catch((reason) => {
      console.error(reason);
    });

    // await this._copyResources(this.build);
    // console.log("copieD");

    // 2. Await the creation and copying of files to the build directory
    const [buildCopied, pagesBuilt] = await Promise.all([
      // The build process needs access to .js and .css
      this._copyResources(this.build),
      // The distribution process needs access to all the files
      //this._copyResources(this.dest),
      this._buildPages(siteData, handlebars.templates),
    ]).catch((reason) => {
      console.error("in 2", reason);
    });

    // Both stage and prod require a distribution of minified and concatenated resources be built and placed in dist and S3
    if (stage === "stage" || stage === "prod") {
      const distributed = await this._createDistribution();
    }

    // Prod requires S3://...archive.zip be deployed to Amplify
    // Currently allowing both stage and prod to go to Amplify. ToDo: Should we allow for a local or S3 hosted stage instead of AWS?
    if (stage === "stage" || stage == "prod") {
      const deployed = await this._deploy(this.appId, this.stage, this.aws);
    }

    console.log(`Elapsed time: ${new Date() - start}ms`);
  }
}

module.exports = WebProducer;
