"use strict";

// Third party dependencies
import { build } from "esbuild";

// Project dependencies
import { vinyl } from "./Utils.js";

class ScriptsPipeline {
  async pipeTo(mergeStream, entryPoints) {
    try {
      build({
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
      }).then((result) => {
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
        return Promise.resolve("scripts done");
      });
      //console.log(text);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
}

module.exports = ScriptsPipeline;
