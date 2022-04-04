"use strict";

// System dependencies
import { Transform } from "stream";

// Project dependencies
import StaticFilesPipeline from "./StaticFilesPipeline.js";
import ScriptsPipeline from "./ScriptsPipeline.js";
import StylesheetsPipeline from "./StylesheetsPipeline.js";
import TemplatePipeline from "./TemplatePipeline.js";

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
    // TODO: Move this inside the constructor for adjacency reasons
    this.mergeStream.on("data", (f) => {
      // Increment the accumulated file size every time we add a new file to the stream
      this.size += f.contents.length;
      // Increment the resource counter every time we add a new file to the stream
      this.resources++;
    });

    if (params?.uris?.data?.stream && params?.uris?.theme?.stream) {
      // Enable template processing
      this.pipelinePromises.push(
        new TemplatePipeline(this.options).pipeTo(this.mergeStream, params.uris.data.stream, params.uris.theme.stream)
      );
    }

    if (params?.files?.stream) {
      // Enable static files processing
      this.pipelinePromises.push(new StaticFilesPipeline(this.options).pipeTo(this.mergeStream, params.files.stream));
    }

    if (params?.scripts?.entryPoints) {
      // Enable scripts processing
      this.pipelinePromises.push(new ScriptsPipeline(this.options).pipeTo(this.mergeStream, params.scripts.entryPoints));
    }

    if (params?.stylesheets?.entryPoints) {
      // Enable stylesheets processing
      this.pipelinePromises.push(new StylesheetsPipeline(this.options).pipeTo(this.mergeStream, params.stylesheets.entryPoints));
    }

    // Wait for all streams to complete
    await Promise.all(this.pipelinePromises);

    // Emit the end event
    this.mergeStream.end();
  }
}

export default WebProducer;
