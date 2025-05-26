// System dependencies
import { Transform } from "stream";

// Project dependencies
import { vinyl } from "./Utils.js";

/**
 * @description: A Gilbert pipeline that passes file from input to output stream without any modification.
 * @class StaticFilesPipeline
 */
class StaticFilesPipeline {
  // Private properties
  #options;

  /**
   * Creates an instance of StaticFilesPipeline.
   * @param {object} options: Hash of runtime options
   * @memberof StaticFilesPipeline
   */
  constructor(options) {
    this.#options = options;

    // Create a new Transform stream as pipable output
    this.transformStream = new Transform({
      objectMode: true,

      // Just change the absolute project source path to the preferred virtual output path
      transform: (file, _, done) => {
        const v = vinyl({
          path: `${file.path.replace(this.#options.relativeRoot, "")}`,
          contents: file.contents,
        });

        done(null, v);
      },
    });

    return this.transformStream;
  }
}

export default StaticFilesPipeline;
