// Third party dependencies
import { build } from "esbuild";

// Project dependencies
import { vinyl } from "./Utils.js";

class ScriptsPipeline {
  /**
   * Creates an instance of TemplatePipeline.
   * @date 2022-02-11
   * @param {object} options: Hash of runtime options
   * @memberof TemplatePipeline
   */
  constructor(options) {
    this.options = options;
  }

  async pipeTo(mergeStream, entryPoints) {
    try {
      const result = await build({
        entryPoints,
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
      for (const out of result.outputFiles) {
        const v = vinyl({
          path: out.path,
          contents: Buffer.from(out.contents),
        });
        // Add the file to the (almost) global merge stream
        mergeStream.push(v);
      }

      // TODO: Consider implementing optional stats using a variation of the following line
      // const text = await esbuild.analyzeMetafile(result.metafile, { verbose: true });

      // Signal to index.js that we have completed
      return "scripts done";
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
}

export default ScriptsPipeline;
