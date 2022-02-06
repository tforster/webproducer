"use strict";

// Third party dependencies
const esbuild = require("esbuild");

// Project dependencies
const Utils = require("./Utils");

class StylesheetsPipeline {
  async pipeTo(mergeStream, entryPoints) {
    try {
      esbuild
        .build({
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
          loader: { ".eot": "file", ".ttf": "file", ".woff": "file", ".svg": "file" },
        })
        .then((result) => {
          for (const out of result.outputFiles) {
            const v = Utils.vinyl({
              path: out.path,
              contents: Buffer.from(out.contents),
            });
            mergeStream.push(v);
          }

          //const text = await esbuild.analyzeMetafile(result.metafile, { verbose: true });
          return Promise.resolve("stylesheets done");
        });
      //console.log(text);
    } catch (err) {
      //console.error(err);
    }
  }
}

module.exports = StylesheetsPipeline;
