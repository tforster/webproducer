"use strict";

// System dependencies
const { Transform } = require("stream");

// Project dependencies
const Utils = require("./Utils");

/**
 * @description: Simple pipeline that pipes the incoming stream directly to the merge stream with no transformations.
 * @date 2022-02-05
 * @class StaticFilesPipeline
 */
class StaticFilesPipeline {
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
        resolve("static");
      });

      // Inject a fresh new Vinyl file with the correct path into the mergeStream
      staticFilesStreamR.on("data", (f) => {
        const v = Utils.vinyl({
          // TODO: images is a testing placeholder and needs to be dynamic, taking into account the unknown of future glob patterns.
          path: `/images/${f.relative}`,
          contents: f.contents,
        });
        mergeStream.push(v);
      });
    });
  }
}

module.exports = StaticFilesPipeline;
