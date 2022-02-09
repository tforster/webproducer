"use strict";

// System dependencies
import { Transform } from "stream";

// Project dependencies
import ErrorHandler from "./ErrorHandler.js";
import ScriptsPipeline from "./ScriptsPipeline.js";
import StaticFilesPipeline from "./StaticFilesPipeline.js";
import StylesheetsPipeline from "./StylesheetsPipeline.js";
import TemplatePipeline from "./TemplatePipeline.js";

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

    // Initialise mergeStream which will aggregate all resources and return to the calling application
    this.mergeStream = new Transform({
      objectMode: true,
      transform: (file, _, done) => {
        done(null, file);
      },
    });
  }

  /**
   * @description: Pipes the various pipelines as required into mergeStream
   * @date 2022-02-06
   * @param {object} params:  Parameters describing the specifics of the pipelines as provided by the consuming application.
   * @memberof WebProducer
   */
  async produce(params) {
    try {
      this.mergeStream.on("data", (f) => {
        // Increment the accumulated file size every time we add a new file to the stream
        this.size += f.contents.length;
        // Increment the resource counter every time we add a new file to the stream
        this.resources++;
      });

      const pipelinePromises = [];

      if (params?.pages?.data?.stream && params?.pages?.theme?.stream) {
        pipelinePromises.push(new TemplatePipeline().pipeTo(this.mergeStream, params.pages.data.stream, params.pages.theme.stream));
      }

      if (params?.files?.stream) {
        pipelinePromises.push(new StaticFilesPipeline().pipeTo(this.mergeStream, params.files.stream));
      }

      if (params?.scripts?.entryPoints) {
        pipelinePromises.push(new ScriptsPipeline().pipeTo(this.mergeStream, params.scripts.entryPoints));
      }

      if (params?.stylesheets?.entryPoints) {
        pipelinePromises.push(new StylesheetsPipeline(this.options).pipeTo(this.mergeStream, params.stylesheets.entryPoints));
      }

      await Promise.all(pipelinePromises);
      this.mergeStream.end();
    } catch (err) {
      errorHandler.handleError(err);
    }
  }
}

module.exports = WebProducer;
