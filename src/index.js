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
 * @description: The entry point of the WebProducer engine
 * @date 2022-02-06
 * @class WebProducer
 */
class WebProducer {
  /**
   * Creates an instance of WebProducer.
   * @date 2022-02-06
   * @memberof WebProducer
   */
  constructor(options) {
    this.options = options;
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

    this.mergeStream.id = "mergeStream";
    streamLog(this.mergeStream);
  }

  /**
   * @description: Pipes the various pipelines as required into mergeStream
   * @date 2022-02-06
   * @param {object} params:  Parameters describing the specifics of the pipelines as provided by the consuming application.
   * @memberof WebProducer
   */
  async produce(params) {
    this.pipelinePromises.push(new Delme().stream.pipe(this.mergeStream, { end: false }));

    if (params?.uris?.data?.stream && params?.uris?.theme?.stream) {
      // Enable template processing
      // TODO: data and theme to be args for the constructor. The this to be a writable stream and pipeTo is .pipe(this.mergeStream)
      this.pipelinePromises.push(
        new TemplatePipeline(this.options).pipeTo(this.mergeStream, params.uris.data.stream, params.uris.theme.stream)
      );
    }

    if (params?.files?.stream) {
      // Enable static files processing
      // TODO: files.stream to be args for the constructor. The this to be a writable stream and pipeTo is .pipe(this.mergeStream)
      this.pipelinePromises.push(new StaticFilesPipeline(this.options).pipeTo(this.mergeStream, params.files.stream));
    }

    if (params?.scripts?.entryPoints) {
      // Enable scripts processing
      // TODO: entrypoints to be args for the constructor. The this to be a writable stream and pipeTo is .pipe(this.mergeStream)
      this.pipelinePromises.push(new ScriptsPipeline(this.options).pipeTo(this.mergeStream, params.scripts.entryPoints));
    }

    if (params?.stylesheets?.entryPoints) {
      // Enable stylesheets processing
      // TODO: entrypoints to be args for the constructor. The this to be a writable stream and pipeTo is .pipe(this.mergeStream)
      this.pipelinePromises.push(new StylesheetsPipeline(this.options).pipeTo(this.mergeStream, params.stylesheets.entryPoints));
    }

    // Wait for all streams to complete
    await Promise.all(this.pipelinePromises);

    // Emit the end event
    this.mergeStream.end();
  }
}

export default WebProducer;
