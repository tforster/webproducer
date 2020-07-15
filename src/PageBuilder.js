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

    const stream = new Readable({
      objectMode: true,
      read: function (vinylFile) {
        this.push(vinylFile);
      },
    });

    // Set some counters
    let pages = 0;
    let redirects = 0;

    // Iterate all available data elements (note: one per "page")
    for (const key in data) {
      const fields = data[key];
      let vinylParams;

      // Only attempt to build a page if the fields data contains a reference to the physical ebs file to use
      if (fields && fields.modelName && templates[`${fields.modelName}.hbs`]) {
        // Merge the data element with the template indicated in the data elements modelName property (required)
        const result = templates[`${fields.modelName}.hbs`](fields);

        vinylParams = {
          path: key.trim().slice(1),
          contents: Buffer.from(result),
        };
        pages++;
      } else if (fields && fields.modelName && fields.modelName === "redirect") {
        vinylParams = {
          path: key.trim().slice(1),
          contents: Buffer.from(key.trim().slice(1)),
          redirect: 301,
          targetAddress: fields.targetAddress,
        };
        redirects++;
      } else {
        console.error(`Missing modelName for >${key}<`);
      }

      // Create and write a new Vinyl object to stream
      if (vinylParams) {
        const vinyl = new Vinyl(vinylParams);
        stream.push(vinyl);
      }
    }

    // End the readable stream
    stream.push(null);

    // Return a Promise of the number of pages built
    return { stream, pages, redirects };
  }
}

module.exports = PageBuilder;
