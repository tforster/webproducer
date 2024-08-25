// System dependencies
import { Readable } from "stream";

// Third party dependencies
import { build } from "esbuild";

// Project dependencies
import { vinyl } from "./Utils.js";

/**
 * @description: A Gilbert pipeline that takes in a stream of js files and pipes them through the esbuild bundler for optimisation.
 * @class ScriptsPipeline
 */
export default class ScriptsPipeline {
  // Private properties
  #options;
  #entryPoints;

  /**
   * Creates an instance of ScriptsPipeline.
   * @param {object} options: Hash of runtime options
   * @memberof ScriptsPipeline
   */
  constructor(options, entryPoints) {
    this.#options = options;
    this.#entryPoints = entryPoints;

    // Create a new Readable stream as pipable output
    this.stream = new Readable({
      objectMode: true,
      read: function (f) {
        this.push(null);
      },
    });
  }

  /**
   * @description: Builds the minified JavaScript bundle(s) using esbuild
   * @return {string}:  Results with optional statistics
   * @memberof ScriptsPipeline
   */
  async build() {
    try {
      const result = await build({
        entryPoints: this.#entryPoints,
        outdir: "/",
        bundle: true,
        sourcemap: true,
        target: ["es2020"],
        format: "iife",
        minify: true,
        write: false,
        metafile: true,
        treeShaking: true,
      });

      // Iterate through the output files and push them to the mergeStream
      for (const out of result.outputFiles) {
        // Create a virtual file object
        const v = vinyl({
          path: out.path,
          contents: Buffer.from(out.contents),
        });

        // Add the virtual file object to the merge stream
        this.stream.push(v);
      }

      // Return a done message, or additional stats if requested
      if (this.#options?.stats) {
        return `Scripts: ${JSON.stringify(result.metafile)}`;
      } else {
        return `Scripts built`;
      }
    } catch (err) {
      console.error("Error in ScriptsPipeline.js", err);
      throw err;
    }
  }
}
