// System dependencies
import {Duplex, PassThrough, Transform} from "stream";

// Project dependencies
import { vinyl } from "./Utils.js";
import { timeStamp } from "console";

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

    this.transformStream = new Transform({
      objectMode: true,

      transform: (file, _, done) => {
        const v = vinyl({
          path: `${file.path.replace(this.#options.relativeRoot, "")}`,
          contents: file.contents,
        });

        done(null, v);
      },
    });


    // const passThrough = new PassThrough({
    //   objectMode: true,
    // });

    // const duplex = new Duplex({
    //   objectMode: true,

    //   write(file, _, done) {
    //     this.push(file);
    //     done();
    //   },

    //   read(file) {
    //     this.push(file)
    //   },
    // });

    // duplex.on("end", () => {
    //   console.log("StaticFilesPipeline: end");
    // });

    // this.duplex = duplex;
    // this.passThrough = passThrough;
    return this.transformStream
  }

  /**
   * @description: Implements the pipeTo method all our pipelines need to provide
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
        const v = vinyl({
          path: `${f.path.replace(this.#options.relativeRoot, "")}`,
          contents: f.contents,
        });
        mergeStream.push(v);
      });
    });
  }
}

export default StaticFilesPipeline;
