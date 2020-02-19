("use strict");

// System dependencies (Built in modules)
const fs = require("fs").promises;
const path = require("path");

// Third party dependencies (Typically found in public NPM packages)
const handlebars = require("handlebars");

// ToDo: Make paths an object with a templates and partials key, so that we can more efficiently split up on line 28

class HandlebarsHelper {
  static async precompile(paths) {
    // Add our own property to store the precompiled templates and partials
    handlebars.templates = {};
    await Promise.all(
      paths.map(async (folder) => {
        const entries = await fs.readdir(folder, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            const source = (await fs.readFile(path.join(folder, entry.name))).toString();
            handlebars.templates[entry.name] = handlebars.compile(source);
          }
        }
      })
    );
    //Return an instance of handlebars that includes our .precompiled object
    handlebars.partials = handlebars.templates;
    return handlebars;
  }
}

module.exports = HandlebarsHelper;
