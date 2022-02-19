#!/usr/bin/env node

// Cache the start time as early as possible for best accuracy
const start = new Date();

// System dependencies
import { readFile } from "fs/promises";

// Third party dependencies
import { Command } from "commander";
import vfs from "vinyl-fs";

// Project dependencies
import WebProducer from "../../src/index.js";

// Trap and log (in detail) any uncaught exceptions so they can be properly accounted for later.
process.on("uncaughtException", (err) => {
  console.error("uncaughtException", err);
});

// Create a new instance of Commander
const program = new Command();

// Get some meta from package.json into our Commander definition
const packagePath = process.argv[1].replace("scripts/cli/index.js", "package.json");
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
  .option("-x, --transform [transform]", "Optional custom data transform")
  .option("-o, --out [out]", "Output directory", "./dist")
  .option("-p, --prefix-css", "Enable vendor prefixing of CSS", false)
  .option("--no-scripts", "Do not process scripts")
  .option("--no-css", "Do not process stylesheets")
  .option("--no-files", "Do not process files")
  .option("--no-pages", "Do not process pages");

program.parse(process.argv);
const options = { ...program.opts() };

// Set the custom pipelines count to zero
let customPipelines = 0;

(async () => {
  const params = {
    pages: !options.pages
      ? false
      : {
          data: { stream: vfs.src([options.data]) },
          theme: { stream: vfs.src(options.theme.split(",")) },
        },
    scripts: !options.scripts ? false : { entryPoints: options.scripts.split(",") },
    stylesheets: !options.css ? false : { entryPoints: options.css.split(",") },
    files: !options.files ? false : { stream: vfs.src(options.files.split(",")), relativeRoot: options.relativeRoot },
    out: options.out,
  };

  try {
    // Check to see if a path to an optional inbound data transform was provided
    if (options.transform && params.pages) {
      // Dynamically import the custom transform module
      const transformStream = await import(`${process.cwd()}/${options.transform}`);
      // Pipe the inbound data stream to the custom transform
      params.pages.data.stream.pipe(transformStream.default);
      // Increment the count of custom pipelines
      customPipelines++;
    }

    // Create a new instance of WebProducer
    const webproducer = new WebProducer(options);

    // Add an onClose event handler that is specific to this CLI app (hence why it is not part of WebProducer)
    webproducer.mergeStream.on("finish", () => {
      console.log(
        `Processed ${webproducer.resources} resources totalling ${(webproducer.size / (1024 * 1024)).toFixed(2)} Mb through ${
          webproducer.pipelinePromises.length + customPipelines
        } pipelines in ${new Date() - start} ms.`
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
