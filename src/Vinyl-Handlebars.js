/* eslint-disable no-restricted-syntax */
("use strict");

// System dependencies (Built in modules)
const path = require("path");
const { Writable } = require("stream");

// Third party dependencies (Typically found in public NPM packages)
const handlebars = require("handlebars");
const through = require("through2");
const Vinyl = require("vinyl");

// ToDo: Make paths an object with a templates and partials key, so that we can more efficiently split up on line 28

/**
 * Implements Vinyl files around Handlebars generated content
 *
 * @class VinylHandlebars
 */
class VinylHandlebars {
  /**
   * Creates an instance of HandlebarsHelper.
   * @memberof HandlebarsHelper
   */
  constructor() {
    this.handlebars = {};
  }

  /**
   * Precompiles the .hbs files found in sourceStream into an instance property
   *
   * @param {stream} sourceStream:  A Readable stream of vinyl files
   * @returns:                      A Promise of completion
   * @memberof HandlebarsHelper
   */
  async precompile(sourceStream) {
    return new Promise((resolve, reject) => {
      handlebars.templates = {};

      const writable = new Writable({
        objectMode: true,
        highWaterMark: 64,
      });

      writable._write = function(file, _, done) {
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
   * ToDo: Switch from Through2 to native Readable stream
   *
   * @param {object} data:  Data, likely from a transformed GraphQL query, to be merged with precompiled .hbs templates
   * @returns:              An object containing the Readable stream of generated pages, and the number of pages processed
   * @memberof HandlebarsHelper
   */
  async build(data) {
    const templates = this.handlebars.templates;
    const stream = through.obj((file, _, done) => {
      done(null, file);
    });

    // Set a page counter
    let pages = 0;

    // Iterate all available data elements (note: one per "page")
    for (const key in data) {
      // Isolate the current data element
      //key = key.trim();
      const fields = data[key];

      // Only attempt to build a page if the fields data contains a reference to the physical ebs file to use
      if (fields && fields.modelName && templates[`${fields.modelName}.hbs`]) {
        // Merge the data element with the template indicated in the data elements modelName property (required)
        const result = templates[`${fields.modelName}.hbs`](fields);

        // key.trim() required to cleanup any spaces that sometimes get added by the content editor
        const vf = new Vinyl({ path: key.trim().slice(1), contents: Buffer.from(result) });
        stream.write(vf);
        pages++;
      } else {
        console.error(`Missing modelName for >${key}<`);
      }
    }
    stream.end();
    // Return a Promise of the number of pages built
    return { stream, pages };
  }
}

module.exports = VinylHandlebars;
