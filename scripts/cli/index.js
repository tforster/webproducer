#!/usr/bin/env node

// Trivial example illustrating how a cli, ultimately called by npx, could be structured.
const start = new Date();

// Third party dependencies
const { Command } = require("commander");
const vfs = require("vinyl-fs");

// TODO: REmove this after debugging Vinyl pathing issue
//const map = require("map-stream");

// Project dependencies
const { description, version, name } = require("../../package.json");
const WebProducer = require("../../src");
//const cliTransform = require("../../tests/cliTransform");

const program = new Command();
program.name(name).description(description).version(version);

program
  .option("-r, --relative-root <string>", "The relative root of all the source files", "./src")
  .option("-d, --data <string>", "Path to the JSON data file.", "./src/data/data.json")
  .option("-t, --theme <string>", "Glob to handlebars files", "./src/theme/**/*.hbs")
  .option("-s, --scripts <string>", "Comma separated list of ES Module entry points", "./src/scripts/main.js")
  .option("-c, --css <string>", "Comma separated list of stylesheet entry points", "./src/stylesheets/main.css")
  .option("-f, --files <string>", "Comma separated list of static file globs", "./src/images/**/*.*")
  .option("-o, --out <string>", "Output directory", "./dist")
  .option("--no-scripts", "Do not process scripts")
  .option("--no-css", "Do not process stylesheets")
  .option("--no-files", "Do not process files")
  .option("--no-pages", "Do not process pages");

program.parse(process.argv);
const options = { ...program.opts() };

// var log = function (file, cb) {
//   console.log(`${file.base}, ${file.cwd}, ${file.path}`);
//   cb(null, file);
// };

(async () => {
  const params = {
    pages: !options.pages
      ? false
      : {
          data: { stream: vfs.src([options.data]) },
          theme: { stream: vfs.src([options.theme]) },
        },
    scripts: !options.scripts ? false : { entryPoints: [options.scripts] },
    stylesheets: !options.css ? false : { entryPoints: [options.css] },
    files: !options.files ? false : { stream: vfs.src([options.files]), relativeRoot: options.relativeRoot },
    out: options.out,
  };

  try {
    // Create a new instance of WebProducer
    const webproducer = new WebProducer();

    // Add an onClose event handler that is specific to this CLI app (hence why it is not part of WebProducer)
    webproducer.mergeStream.on("finish", () => {
      console.log(
        `Processed ${webproducer.resources} resources totalling ${(webproducer.size / (1024 * 1024)).toFixed(2)} Mb in ${
          new Date() - start
        } ms.`
      );
    });

    // Start producing
    webproducer.produce(params);
    // Pipe the produced files to a destination folder on the local filesystem
    webproducer.mergeStream.pipe(vfs.dest(params.out));
  } catch (err) {
    console.error("WebProducer CLI error", err);
  }
})();
