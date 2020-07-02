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
const config = require("./Config");
const GraphQLDataProvider = require("./GraphQLDataProvider");
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

    // set the configuration after parsing the config YAML or file pointing to YAML
    try {
      this.config = config(configPathOrString)
    }
    catch (err) {
      // If we don't have config there's no point in continuing
      console.error("Exiting")
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
    const srcStreamReadable = this.src.type === "s3"
      ? new vs3(this.src)
      : vfs;

    // Set the readable and writable destination streams to either a VinylFS or Vinyl-S3 stream
    let destStreamWritable;
    let destStreamReadable;

    if (this.dest.type === "s3") {
      destStreamWritable = vs3.dest(this.dest);
      const z = new vs3(this.dest);
      destStreamReadable = z.src(this.dest.path + "**/*"); // Remember, S3 doesn't use a leading slash
    } else {
      destStreamWritable = vfs.dest(this.dest.path);
      destStreamReadable = vfs.src(this.dest.path + "/**/*");
    }

    return { srcStreamReadable, destStreamWritable, destStreamReadable }
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
    const k = await destinationFilesParsed;
    // Template source is expected to be in a stage specific and lower cased subfolder, eg, /dev, /stage or /prod
    const srcRoot = this.src.base;

    try {
      // Parallelise fetching data from API, precompiling templates and all from async stream reading
      var [siteData, _] = await Promise.all([
        // We use /db/**/* since we already constructed the S3 Stream with s3://bucket/src/{stage}
        await GraphQLDataProvider.data(
          srcStreamReadable.src(`${srcRoot}/db/**/*`),
          config
        ),
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

    // Create an array of source streams to merge to the destination stream
    const streamsToMerge = [

      // Add all files to the stream other than those in folders we are specifically interacting with
      // ToDo: Consider externalising to webproducer.yml for more control
      srcStreamReadable.src(
        [
          `${srcRoot}/**/*.*`,
          `!${srcRoot}/db/**`,
          `!${srcRoot}/scripts/**`,
          `!${srcRoot}/stylesheets/**`,
          `!${srcRoot}/theme/**`,
        ]
      ),

      // Minify JavaScript files and add to the destination stream
      srcStreamReadable
        .src(`${srcRoot}/scripts/**/*.js`)
        .pipe(terser())
        .pipe(sourcemaps.write("/")),

      // Minify CSS files and add to the destination stream
      srcStreamReadable
        .src(`${srcRoot}/stylesheets/**/*.css`)
        .pipe(sourcemaps.init())
        .pipe(cleanCSS())
        .pipe(sourcemaps.write("/")),

      // Minify HTML files and add to the destination stream
      pages.stream.pipe(minifyHtml({ collapseWhitespace: true, removeComments: true })),
    ];



    // Ensure the destination files have been passed before the next step    
    await destinationFilesParsed;

    // Aggregate all source streams into the destination stream, with optional intermediate zipping
    await Promise.all(
      streamsToMerge.map(
        // Promisify each Readable Vinyl stream
        async (source) => {


          return new Promise((resolve, reject) => {
            // Set success and failure handlers
            source.on("end", () => {
              console.log("profile", "merge ended");
              return resolve();
            });

            // Set failure handlers
            source.on("error", (err) => {
              console.error("MERGE:", err);
              reject(err);
            });

            // Account for possible zipping of contents
            if (config.destination.archive) {
              // Merge streams into a zip file before piping to the destination
              source
                // this was going to break anyway coz it's outdated metafy code
                .pipe(Metafy.process(config.destination))
                // TODO: Refactor vzip to zip if archive name provide, or simply pass through, allowing us to skip this ugly if/else
                .pipe(vzip.zip())
                .pipe(destStreamWritable, { end: false });
            } else {
              // Merge streams directly to the destination
              console.log("Piping to resolveUpdates()")
              source
                .pipe(metafy.resolveUpdates())
                .pipe(destStreamWritable, { end: false });
            }

          })

        }
      )
    );


    destStreamWritable.on("end", (x) => {
      console.log("All done, you can go home now.")
    });

    destStreamWritable.on("finish", (x) => {
      console.log("All done, you can go home now.")
    });

    destStreamWritable.end();



  }
}

module.exports = WebProducer;
