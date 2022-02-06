"use strict";

// System dependencies
const { Writable } = require("stream");

// Third party dependencies
const handlebars = require("handlebars");
const htmlMinify = require("html-minifier").minify;
const Utils = require("./Utils");

class TemplatePipeline {
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
      handlebars.partials = templates;

      // Iterate the pages sub object of data
      for (const [key, page] of Object.entries(data.pages)) {
        // Check that we have a page and modelName otherwise gracefully exit this specific iteration
        if (!(page && page.modelName)) {
          console.warn("Unexpected condition: page and/or modelName not found.");
          continue;
        }

        // Cleanup any accidental whitespace
        const path = key.trim();
        // Declare a placeholder for the Vinyl file that will be generated
        let vinylFile;

        // Get the template referenced by the modelName
        const template = templates[`${page.modelName}.hbs`];

        if (template) {
          // Generate content by merging the pageData into the named Handlebars template
          const generatedContents = template(page);

          // Create a new Vinyl object from the generated data
          vinylFile = Utils.vinyl({
            path,
            contents: Buffer.from(generatedContents),
          });

          if (vinylFile.extname === "" || vinylFile.extname === ".html") {
            // This generated file in HTML and the contents should be minified
            vinylFile.contents = Buffer.from(
              htmlMinify(vinylFile.contents.toString(), { collapseWhitespace: true, removeComments: true })
            );
          }
        } else if (page.modelName === "redirect") {
          // Redirects are pseudo-virtual text files that are not created via a handlebars template
          vinylFile = Utils.vinyl({
            path,
            contents: Buffer.from(path),
            redirect: 301,
            targetAddress: page.targetAddress,
          });
        } else {
          console.warn("Unexpected condition: page and/or modelName not found.");
          continue;
        }

        // Add the vinyl file to the mergeStream
        mergeStream.push(vinylFile);
      }

      // Tell index.js that templates have finished processing
      resolve("templates");
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
    const templates = {};
    let data = {};

    // Process the theme stream to build an in-memory array of compiled handlebars templates
    const themeStreamW = new Writable({
      objectMode: true,
      write: (file, _, done) => {
        // Compile the theme file into the handlebars.templates array
        templates[file.basename] = handlebars.compile(file.contents.toString());
        done();
      },
      error: (err) => {
        console.error("Error themeStreamW", err);
      },
    });

    // Process the data stream to create an in-memory data object
    const dataStreamW = new Writable({
      objectMode: true,
      write: (file, _, done) => {
        // TODO: Improve handling in case we get non JSON data for some reason
        data = JSON.parse(file.contents.toString());
        done();
      },
    });

    // Start piping both in parallel
    dataStreamR.pipe(dataStreamW);
    themeStreamR.pipe(themeStreamW);

    // Allow all the streams to finish processing before returning
    await Utils.streamsFinish([dataStreamW, themeStreamW]);

    return { data, templates };
  }
}

module.exports = TemplatePipeline;
