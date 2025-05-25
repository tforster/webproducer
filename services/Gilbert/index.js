// System dependencies
import { Transform } from "stream";

// Third party dependencies
import mime from "mime";

// Project dependencies
import StaticFilesPipeline from "./StaticFilesPipeline.js";
import ScriptsPipeline from "./ScriptsPipeline.js";
import StylesheetsPipeline from "./StylesheetsPipeline.js";
import TemplatePipeline from "./TemplatePipeline.js";

// Crude global exception handler
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception", err);
});

/**
 * @description: The entry point of the Gilbert compiler engine
 * @class Gilbert
 */
class Gilbert {
  // Private properties
  #options;
  #pipeCounter;

  /**
   * Creates an instance of Gilbert.
   * @date 2024-08-25
   * @param {object} options: Hash of runtime options including the relative root of the project and the debug flag.
   * @memberof Gilbert
   */
  constructor(options) {
    // .produce was renamed to .compile. This is a temporary alias to maintain backwards compatibility.
    this.produce = this.compile;

    // Initialise private properties
    this.#pipeCounter = 0;
    this.#options = options;

    // Public properties exposed to the calling application
    this.resources = 0;
    this.size = 0;

    // Initialise public mergeStream which will aggregate all resources and return to the calling application
    this.mergeStream = new Transform({
      objectMode: true,
      transform: (file, _, done) => {
        done(null, file);
      },
    });

    // Housekeeping: Count resources, accumulate the file size and set missing content types.
    this.mergeStream.on("data", (file) => {
      // Check for contents before incrementing the size; the stream can emit empty files in the case of directories.
      if (file.contents) {
        // Increment the accumulated file size every time we add a new file to the stream
        this.size += file.contents.length;
        // Increment the resource counter every time we add a new file to the stream
        this.resources++;

        // If the file doesn't have a content type (preset only in TemplatePipeline), set it to the default
        if (!file.contentType) {
          file.contentType = mime.getType(file.path);
        }
      }
    });

    // Useful for debugging
    this.mergeStream.on("end", () => {
      // if (this.#options.debug) {
      console.log(`MergeStream ended: ${this.resources} resources, ${this.size} bytes`);
      // }
    });

    // Decrement the count of pipes as each stream is unpiped, eventually ending the mergeStream itself
    this.mergeStream.on("unpipe", (src) => {
      if (this.#options.debug) {
        console.log("Unpiping:", src);
      }
      this.#pipeCounter--;

      // If we have no more pipes, end the mergeStream
      if (this.#pipeCounter === 0) {
        this.mergeStream.end();
      }
    });
  }

  /**
   * @description: Compiles the contents from the various sources into a single stream.
   * @param {object} params:  Parameters describing the specifics of the pipelines as provided by the consuming application.
   * @memberof Gilbert
   */
  async compile(params) {
    // For compiling data and templates, both streams must be present. Graceful degredation means static files can still be parsed.
    if (params?.uris?.data?.stream && params?.uris?.theme?.stream) {
      // Increment the pipe counter
      this.#pipeCounter++;

      // Create a new instance of the TemplatePipeline
      const templatePipeline = new TemplatePipeline(this.#options, params.uris.data.stream, params.uris.theme.stream);
      // Prep fetches the data and templates and we need both to be ready before we can build
      await templatePipeline.prep();

      // Open the stream
      templatePipeline.stream.pipe(this.mergeStream, { end: false });

      // Start building files into the stream
      templatePipeline.build();

      if (this.#options.debug) {
        console.log("Templates parsed");
      }
    }

    // Static files processing. These just pass through unadulterated.
    if (params?.files?.stream) {
      this.#pipeCounter++;
      params.files.stream.pipe(new StaticFilesPipeline(this.#options)).pipe(this.mergeStream, { end: false });

      if (this.#options.debug) {
        console.log("Files parsed");
      }
    }

    // Scripts processing. Scripts are bundled and minified before being added to the mergeStream.
    if (params?.scripts?.entryPoints) {
      this.#pipeCounter++;
      const scriptsPipeline = new ScriptsPipeline(this.#options, params.scripts.entryPoints);
      // Building is asynchronous because esbuild has to read from the filesystem :(
      const results = await scriptsPipeline.build();
      scriptsPipeline.stream.pipe(this.mergeStream, { end: false });

      if (this.#options.debug) {
        console.log("Scripts parsed", results);
      }
    }

    // Stylesheets processing. Stylesheets are bundled and minified before being added to the mergeStream.
    if (params?.stylesheets?.entryPoints) {
      this.#pipeCounter++;
      const stylesheetsPipeline = new StylesheetsPipeline(this.#options, params.stylesheets.entryPoints);
      // Building is asynchronous because esbuild has to read from the filesystem :(
      const results = await stylesheetsPipeline.build();
      stylesheetsPipeline.stream.pipe(this.mergeStream, { end: false });

      if (this.#options.debug) {
        console.log("Stylesheets parsed", results);
      }
    }
  }
}

export default Gilbert;
