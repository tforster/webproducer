// System dependencies
import { Transform } from "stream";

// Third party dependencies
import mime from "mime";

// Project dependencies
import StaticFilesPipeline from "./StaticFilesPipeline.js";
import ScriptsPipeline from "./ScriptsPipeline.js";
import StylesheetsPipeline from "./StylesheetsPipeline.js";
import TemplatePipeline from "./TemplatePipeline.js";
import Delme from "./Delme.js";

import { streamLog } from "./Utils.js";

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception", err);
});

/**
 * @description: The entry point of the Gilbert engine
 * @date 2022-02-06
 * @class Gilbert
 */
class Gilbert {
  // Private properties
  #options;
  #pipeCounter

  /**
   * Creates an instance of Gilbert.
   * @date 2022-02-06
   * @memberof Gilbert
   */
  constructor(options) {
    this.#pipeCounter = 0;

    this.options = options;
    this.options.stats = true;
    // Set the counters for total files output and accumulated file size to zero
    this.resources = 0;
    this.size = 0;
    this.pipelinePromises = [];

    // Initialise mergeStream which will aggregate all resources and return to the calling application
    this.mergeStream = new Transform({
      objectMode: true,
      transform: (file, _, done) => {
        done(null, file);
      },
    });

    // Housekeeping: Count resources, accumulate the file size and set missing content types.
    this.mergeStream.on("data", (file) => {
      // Increment the accumulated file size every time we add a new file to the stream
      this.size += file.contents.length;
      // Increment the resource counter every time we add a new file to the stream
      this.resources++;
      // If the file doesn't have a content type (preset only in TemplatePipeline), set it to the default
      if (!file.contentType) {
        file.contentType = mime.getType(file.path);
      }
    });

    this.mergeStream.on("end", () => {  
      console.log(`Gilbert: ${this.resources} resources, ${this.size} bytes`);
    });

    this.mergeStream.on("unpipe", (src) => {
      // console.log("Gilbert: unpipe", src);
      this.#pipeCounter--;
      if (this.#pipeCounter === 0) {
        this.mergeStream.end();
      }
    });


    this.mergeStream.id = "mergeStream";
    // streamLog(this.mergeStream);
  }

  /**
   * @description: Pipes the various pipelines as required into mergeStream
   * @date 2022-02-06
   * @param {object} params:  Parameters describing the specifics of the pipelines as provided by the consuming application.
   * @memberof Gilbert
   */
  async produce(params) {
    // this.pipelinePromises.push(new Delme().stream.pipe(this.mergeStream, { end: false }));
    // this.#pipeCounter++;
    // new Delme().stream.pipe(this.mergeStream, { end: false })

    // if (params?.uris?.data?.stream && params?.uris?.theme?.stream) {
    //   // Enable template processing
    //   // TODO: data and theme to be args for the constructor. The this to be a writable stream and pipeTo is .pipe(this.mergeStream)
    //   this.pipelinePromises.push(
    //     new TemplatePipeline(this.options).pipeTo(this.mergeStream, params.uris.data.stream, params.uris.theme.stream)
    //   );
    // }

    // Static files processing. These just pass through unadulterated.
    if (params?.files?.stream) {      
      this.#pipeCounter++;
      params.files.stream.pipe(new StaticFilesPipeline(this.options)).pipe(this.mergeStream, { end: false });
    }

    // Scripts processing. Scripts are bundled and minified before being added to the mergeStream.
    if (params?.scripts?.entryPoints) {
      this.#pipeCounter++;
      const scriptsPipeline = new ScriptsPipeline(this.options, params.scripts.entryPoints);
      // Building is asynchronous because esbuild has to read from the filesystem :(
      await scriptsPipeline.build();
      scriptsPipeline.stream.pipe(this.mergeStream, { end: false });
    }
    // Stylesheets processing. Stylesheets are bundled and minified before being added to the mergeStream.    
    if (params?.stylesheets?.entryPoints) {
      this.#pipeCounter++;
      const stylesheetsPipeline = new StylesheetsPipeline(this.options, params.stylesheets.entryPoints);
      // Building is asynchronous because esbuild has to read from the filesystem :(
      await stylesheetsPipeline.build();      
      stylesheetsPipeline.stream.pipe(this.mergeStream, { end: false });
    }


    // Return the results
    // console.log(JSON.stringify(results, null, 2));
  }
}

export default Gilbert;
