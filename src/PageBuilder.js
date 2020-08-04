/* eslint-disable no-restricted-syntax */
("use strict");

// System dependencies (Built in modules)
const { Readable, Writable } = require("stream");

// Third party dependencies (Typically found in public NPM packages)
const handlebars = require("handlebars");
const Vinyl = require("vinyl");

/**
 * Implements the core functionality that allows WebProducer to combine data and templates to produce pages. 
 
 * Note that this class depends upon Handlebars which implies that WebProducer requires Handlebars syntax in templates. Testing and
 * benchmarking of several templating engines was performed before deciding to align with Handlebars.
 *
 * @class PageBuilder
 */
class PageBuilder {
  /**
   * Creates an instance of PageBuilder
   *
   * @memberof PageBuilder
   */
  constructor() {
    // Track the handlebars engine
    this.handlebars = {};
  }

  /**
   * Precompiles the .hbs files found in sourceStream into an instance property
   *
   * @param {stream} sourceStream:  A Readable stream of vinyl files
   * @returns:                      A Promise of completion
   * @memberof PageBuilder
   */
  async precompile(sourceStream) {
    return new Promise((resolve, reject) => {
      handlebars.templates = {};

      const writable = new Writable({
        objectMode: true,
        highWaterMark: 64,
      });

      writable._write = function (file, _, done) {
        handlebars.templates[file.basename] = handlebars.compile(file.contents.toString());
        done();
      };

      writable.on("error", (err) => {
        console.error("precompile():", err);
        reject(err);
      });

      writable.on("finish", () => {
        this.handlebars = handlebars;
        this.handlebars.partials = handlebars.templates;
        // Resolve our completion
        return resolve();
      });

      // Start piping
      sourceStream.pipe(writable);
    });
  }

  /**
   * Merges precompiled .hbs templates with data to generate a Readable stream of generated .html
   *
   * @param {object} data:  Data, likely from a transformed GraphQL query, to be merged with precompiled .hbs templates
   * @returns:              An object containing the Readable stream of generated pages, and the number of pages and redirects processed
   * @memberof PageBuilder
   */
  async build(data) {
    const templates = this.handlebars.templates;

    // Use htmlStream for strictly HTML Vinyl objects. The htmlStream will be routed through the HTML minifier later.
    const htmlStream = new Readable({
      objectMode: true,
      read: function (vinylFile) {
        this.push(vinylFile);
      },
    });

    // Use fileStream for all non-HTML types including but not limited to sitemap.xml, robots.txt, feed.xml, etc.
    const fileStream = new Readable({
      objectMode: true,
      read: function (vinylFile) {
        this.push(vinylFile);
      },
    });

    // Set some counters
    let pages = 0;
    let redirects = 0;
    let files = 0;

    // Iterate all available data elements (note: one per "page")
    for (const key in data) {
      const pageData = data[key];

      if (pageData && pageData.modelName) {
        if (templates[`${pageData.modelName}.hbs`]) {
          // Generate content by merging the pageData into the named Handlebars template
          const generatedContents = templates[`${pageData.modelName}.hbs`](pageData);

          // Create a new Vinyl object from the generated data
          const vinyl = new Vinyl({
            path: key.trim().slice(1),
            contents: Buffer.from(generatedContents),
          });

          // Check whether the resulting Vinyl file is HTML, and push to the appropriate stream, and increase the counter.
          if (vinyl.extname === "" || vinyl.extname === ".html") {
            htmlStream.push(vinyl);
            pages++;
          } else {
            fileStream.push(vinyl);
            files++;
          }
        } else if (pageData.modelName === "redirect") {
          // Redirects are basically text files and don't go through the HTML minifier but we like to count them separate from files
          const vinyl = new Vinyl({
            path: key.trim().slice(1),
            contents: Buffer.from(key.trim().slice(1)),
            redirect: 301,
            targetAddress: pageData.targetAddress,
          });
          // Note that while we push to fileStream, we increment the redirects counter.
          redirects++;
          fileStream.push(vinyl);
        } else {
          console.error(`>>> modelName not found for ${key}`);
        }
      }
    }

    // End the readable streams
    htmlStream.push(null);
    fileStream.push(null);

    // Return a Promise (because we are async) of the streams and counters
    return { htmlStream, fileStream, pages, redirects, files };
  }
}

module.exports = PageBuilder;
