#!/usr/bin/env node

// Cache the start time as early as possible for best accuracy in elapsed time reporting.
const start = new Date();

// System dependencies
import { readFile, stat } from "fs/promises";
import path from "path";

// Third party dependencies
import { Command } from "commander";
import vfs from "vinyl-fs";

// Project dependencies
// import WebProducer from "../../src/index.js";
import Gilbert from "@tforster/gilbert";

// Trap and log (in detail) any uncaught exceptions so they can be properly accounted for later.
process.on("uncaughtException", (err) => {
  console.error("uncaughtException", err);
});

// Create a new instance of Commander
const program = new Command();

const fileExists = async (filePath) => {
  const exists = !!(await stat(path.join(process.cwd(), filePath)).catch(() => false));
  return exists;
};

// Get some meta from package.json into our Commander definition
// TODO: Add some error handling in case there isn't a package.json for some reason
const packagePath = `${process.cwd()}/package.json`;
const { description, version, name } = JSON.parse(await readFile(packagePath, { encoding: "utf-8" }));
program.name(name).description(description).version(version);

// Create all possible CLI options, with defaults where possible.
program
  .option("-r, --relative-root [root]", "The relative root of all the source files", "./src")
  .option("-d, --data [data]", "Path to the JSON data file.", "./src/data/data.json")
  .option("-t, --theme [theme]", "Glob to handlebars files", "./src/theme/**/*.hbs")
  .option("-s, --scripts [scripts]", "Comma separated list of ES Module entry points", "./src/scripts/main.js")
  .option("-c, --css [css]", "Comma separated list of stylesheet entry points", "./src/stylesheets/main.css")
  .option("-f, --files [files]", "Comma separated list of static file globs", "./src/images/**/*.*")
  .option("-x, --transform [transform]", "Optional custom data transform", "./src/data/transform.js")
  .option("-o, --out [out]", "Output directory", "./dist")
  .option("-p, --prefix-css", "Enable vendor prefixing of CSS", false)
  .option("--no-scripts", "Do not process scripts")
  .option("--no-css", "Do not process stylesheets")
  .option("--no-files", "Do not process static files")
  .option("--no-uris", "Do not process uris");

program.parse(process.argv);
const options = { ...program.opts() };

// Expand the relative root to absolute
options.relativeRoot = path.join(process.cwd(), options.relativeRoot);

// Set the custom pipelines count to zero
let customPipelines = 0;

(async () => {
  // TODO: Refactor for incremental fileExists checking, but only if the file is in play (e.g. pipeline is active)
  const params = {
    uris: !options.uris
      ? false
      : {
          data: { stream: vfs.src([options.data]) },
          theme: { stream: vfs.src(options.theme.split(",")) },
        },
    scripts: !options.scripts ? false : { entryPoints: options.scripts.split(",") },
    stylesheets: !options.css ? false : { entryPoints: options.css.split(",") },
    files: !options.files
      ? false
      : {
          stream: vfs.src(options.files.split(",")),
          relativeRoot: options.relativeRoot,
        },
  };

  try {
    // Check to see if a uris object and actual transform file exists
    if (params.uris && (await fileExists(options.transform))) {
      // Dynamically import the custom transform module
      const transformStream = await import(`${process.cwd()}/${options.transform}`);
      // Pipe the inbound data stream to the custom transform
      params.uris.data.stream.pipe(transformStream.default);
      // Increment the count of custom pipelines
      customPipelines++;
    }

    // Create a new instance of WebProducer
    const webproducer = new Gilbert(options);

    // Initialise the destination
    const dest = vfs.dest(options.out);

    // Add an event handler to write some useful information to the console when everything is complete
    dest.on("end", () => {
      console.log(
        `Processed ${webproducer.resources} resources totalling ${(webproducer.size / (1024 * 1024)).toFixed(2)} Mb through ${
          webproducer.pipelinePromises.length + customPipelines
        } pipelines in ${new Date() - start} ms.`
      );
    });

    // Start producing
    webproducer.produce(params);

    // Pipe the produced files to the destination
    webproducer.mergeStream.pipe(dest);
  } catch (err) {
    console.error("WebProducer CLI error", err);
  }
})();
