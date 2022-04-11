"use strict";

// System dependencies
import { Writable } from "stream";

// Third party dependencies
import handlebars from "handlebars";
import { minify as htmlMinify } from "html-minifier";
import { log, streamLog, streamsFinish, vinyl } from "./Utils.js";
import mime from "mime";

// TODO!!!! 1. Expect dataStream to be type object of individual URI objects; 2. Wait for themeStream to complete loading to memory
// and THEN pipe dataStream to themeStream

class TemplatePipeline {
  /**
   * Creates an instance of TemplatePipeline.
   * @date 2022-02-11
   * @param {object} options: Hash of runtime options
   * @memberof TemplatePipeline
   */
  constructor(options) {
    this.options = options;
  }

  /**
   * @description: Implements the pipeTo method all our pipelines need to provide
   * @date 2022-02-05
   * @param {TransformStream} mergeStream:  The (almost) global stream that all incoming streams are eventually merged to.
   * @param {ReadableStream} dataStreamR:   The incoming stream of JSON data that will drive the page creation
   * @param {ReadableStream} themeStreamR:  The incoming stream of handlebars files
   * @return {Promise}:                     Resolves to indicate completion of this pipeline
   * @memberof StaticFilesPipeline
   */
  async pipeTo(mergeStream, dataStreamR, themeStreamR) {
    const { data, templates } = await this.parseFiles(dataStreamR, themeStreamR);

    return new Promise((resolve) => {
      if (!data.uris) {
        const msg = "TemplatePipeline: Empty or missing data.uris.";
        // No data? No point in trying to create content so immediately resolve().
        console.warn(msg);
        resolve(msg);
      }

      handlebars.partials = templates;
      console.log(new Date() - this.options.startTime + " templates starting");
      // Iterate the uris sub object of data
      for (const [key, uri] of Object.entries(data.uris)) {
        // Check that we have a page and webProducerKey otherwise gracefully exit this specific iteration
        if (!uri?.webProducerKey) {
          console.warn(`Unexpected condition: webProducerKey not found processing [${key}, ${uri}]`);
          continue;
        }

        // Cleanup any accidental whitespace
        const path = key.trim();
        // Declare a placeholder for the Vinyl file that will be generated
        let vinylFile;

        // Get the template referenced by the webProducerKey
        const template = templates[`${uri.webProducerKey}.hbs`];

        if (template) {
          // Generate content by merging the pageData into the named Handlebars template
          const generatedContents = template(uri);

          // Create a new Vinyl object from the generated data
          vinylFile = vinyl({
            path,
            contents: Buffer.from(generatedContents),
            contentType: mime.getType(path),
          });

          if (vinylFile.extname === "" || vinylFile.extname === ".html") {
            // This generated file in HTML and the contents should be minified
            vinylFile.contents = Buffer.from(
              htmlMinify(vinylFile.contents.toString(), { collapseWhitespace: true, removeComments: true })
            );
            // Force extensionless to HTML mime type
            vinylFile.contentType = "text/html";
          }
        } else if (uri.webProducerKey === "redirect") {
          // Redirects are pseudo-virtual text files that are not created via a handlebars template
          vinylFile = vinyl({
            path,
            contents: Buffer.from(uri.targetAddress),
            redirect: 301,
            targetAddress: uri.targetAddress,
          });
        } else {
          log(`Unexpected condition: page and webProducerKey not found. ${key}, ${uri}`);
          continue;
        }

        // Add the vinyl file to the mergeStream
        mergeStream.push(vinylFile);
      }
      console.log(new Date() - this.options.startTime + " templates complete");
      // Tell index.js that templates have finished processing
      resolve("TemplatePipeline: Complete");
    });
  }

  /**
   * @description:  Parses out the data as a file from dataStreamR and, compiles all the handlebars templates found in themeStreamR.
   * @date 2022-02-05
   * @param {ReadableStream} dataStreamR:   The incoming stream of data such as a local file or a remote GraphQL query.
   * @param {ReadableStream} themeStreamR:  The incoming stream of handlebars templates and partials.
   * @return {object}:                      An object containing a data property and a compiled handlebars templates property
   * @memberof TemplatePipeline
   */
  async parseFiles(dataStreamR, themeStreamR) {
    dataStreamR.id = "dataStreamR";
    themeStreamR.id = "themeStreamR";
    streamLog(dataStreamR);
    streamLog(themeStreamR);

    const templates = {};
    let data = {};

    dataStreamR.on("end", () => {
      console.log(new Date() - this.options.startTime + " data finished reading");
    });
    themeStreamR.on("end", () => {
      console.log(new Date() - this.options.startTime + " themes finished reading");
    });

    // Process the theme stream to build an in-memory array of compiled handlebars templates
    const themeStreamW = new Writable({
      objectMode: true,
      write: (file, _, done) => {
        // Compile the theme file into the handlebars.templates hash
        templates[file.relative] = handlebars.compile(file.contents.toString());
        console.log(`${new Date() - this.options.startTime}: compiled ${file.relative}`);
        done();
      },
    });

    themeStreamW.id = "themeStreamW";
    streamLog(themeStreamW);

    // Process the data stream to create an in-memory data object
    const dataStreamW = new Writable({
      objectMode: true,
      write: (file, _, done) => {
        // TODO: Improve handling in case we get non JSON data for some reason
        let rawData = "";

        if (file.contents) {
          // A Vinyl file object will have a .contents property
          rawData = file.contents.toString();
        } else {
          // A non Vinyl file, e.g. result of a fetch() response, should be a vanilla buffer
          rawData = file.toString();
        }

        try {
          data = JSON.parse(rawData);
        } catch (err) {
          console.warn("Unexpected condition: Valid JSON not found.\n", rawData);
          data = {};
        }

        done();
      },
    });

    dataStreamW.id = "dataStreamW";
    streamLog(dataStreamW);

    // Start piping both in parallel
    dataStreamR.pipe(dataStreamW);
    themeStreamR.pipe(themeStreamW);

    // Allow all the streams to finish processing before returning
    await streamsFinish([dataStreamW, themeStreamW]);

    // Cleanup
    dataStreamR.unpipe(dataStreamW);
    themeStreamR.unpipe(themeStreamW);
    console.log(`${new Date() - this.options.startTime}: Returning { data, templates }`);
    return { data, templates };
  }
}

export default TemplatePipeline;
