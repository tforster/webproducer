"use strict";

// Project dependencies
import { vinyl } from "./Utils.js";

/**
 * @description: Simple pipeline that pipes the incoming stream directly to the merge stream with no transformations.
 * @date 2022-02-05
 * @class StaticFilesPipeline
 */
class StaticFilesPipeline {
  /**
   * Creates an instance of TemplatePipeline.
   * @date 2022-02-11
   * @param {object} options: Hash of runtime options
   * @memberof TemplatePipeline
   */
  constructor(options) {
    this.options = options;
  }

  /**
   * @description: Implements the pipeTo method all our pipelines need to provide
   * @date 2022-02-05
   * @param {TransformStream} mergeStream:        The (almost) global stream that all incoming streams are eventually merged to.
   * @param {ReadableStream} staticFilesStreamR:  The incoming stream of loose files that are not scripts, stylesheets or templates.
   * @return {Promise}:                           Resolves to indicate completion of this pipeline
   * @memberof StaticFilesPipeline
   */
  pipeTo(mergeStream, staticFilesStreamR) {
    return new Promise((resolve) => {
      // Tell index.js we are done processing static files
      staticFilesStreamR.on("end", () => {
        console.log(new Date() - this.options.startTime + " static files finished reading");

        resolve("static");
      });

      // Inject a fresh new Vinyl file with the correct path into the mergeStream
      staticFilesStreamR.on("data", (f) => {
        const v = vinyl({
          path: `${f.path.replace(this.options.relativeRoot, "")}`,
          contents: f.contents,
        });
        mergeStream.push(v);
      });
    });
  }
}

export default StaticFilesPipeline;
