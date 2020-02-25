/* eslint-disable no-restricted-syntax */
("use strict");

// System dependencies (Built in modules)
const fs = require("fs").promises;
const path = require("path");

// Third party dependencies (Typically found in public NPM packages)
const handlebars = require("handlebars");
const through = require("through2");
const Vinyl = require("vinyl");

// ToDo: Make paths an object with a templates and partials key, so that we can more efficiently split up on line 28

class HandlebarsHelper {
  constructor() {
    this.handlebars = {};
  }

  async precompile(paths) {
    // Add our own property to store the precompiled templates and partials
    handlebars.templates = {};
    await Promise.all(
      paths.map(async (folder) => {
        const entries = await fs.readdir(folder, { withFileTypes: true });
        console.log("HandlebarsHelper.precompile.entries:", entries);
        for (const entry of entries) {
          if (entry.isFile()) {
            const source = (await fs.readFile(path.join(folder, entry.name))).toString();
            handlebars.templates[entry.name] = handlebars.compile(source);
          }
        }
      })
    );
    //Return an instance of handlebars that includes our .precompiled object

    //this.partials = this.templates;
    this.handlebars = handlebars;
    this.handlebars.partials = handlebars.templates;
    return this;
  }

  async build(data) {
    const templates = this.handlebars.templates;
    const stream = through.obj((file, _, done) => {
      done(null, file);
    });

    // Set a page counter
    let pages = 0;

    // Iterate all available data elements (note: one per "page")
    for (const key in data) {
      console.log("_buildPages:key", key);

      // Isolate the current data element
      const fields = data[key];
      console.log("_buildPages:fields", typeof fields);

      // Only attempt to build a page if the fields data contains a reference to the physical ebs file to use
      if (fields._modelApiKey && templates[`${fields._modelApiKey}.hbs`]) {
        // Merge the data element with the template indicated in the data elements _modelApiKey property (required)
        const result = templates[`${fields._modelApiKey}.hbs`](fields);
        // Calculate the full relative path to the output file
        const filePath = path.join(key);

        const vf = new Vinyl({ path: key.slice(1), contents: Buffer.from(result) });
        stream.write(vf);
        pages++;
        console.log("_buildPages:_modelApiKey", fields._modelApiKey, filePath);
      }
    }
    stream.end();
    // Return a Promise of the number of pages built
    return { stream, pages };
  }
}

module.exports = HandlebarsHelper;
