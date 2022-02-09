"use strict";

// Third party dependencies

const esbuild = require("esbuild");

// Project dependencies
const Utils = require("./Utils.js");

class StylesheetsPipeline {
  constructor(options) {
    this.options = options;
  }
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
        .then(async (result) => {
          for (const out of result.outputFiles) {
            const path = out.path;
            //const contents = Buffer.from(await this.autoPrefix(out.contents));
            let contents;
            // Optionally prefix the css

            if (path.endsWith(".css") && this.options.autoprefixCss) {
              contents = Buffer.from(await this.autoPrefix(out.text));
            } else {
              contents = Buffer.from(out.contents);
            }

            const v = Utils.vinyl({
              path,
              contents,
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

  autoPrefix(css) {
    // Only require if we choose to enable auto prefixing
    const autoprefixer = require("autoprefixer");
    const postcss = require("postcss");

    return postcss([autoprefixer])
      .process(css)
      .then((result) => {
        result.warnings().forEach((warn) => {
          console.warn(warn.toString());
        });
        return result.css;
      });
  }
}

module.exports = StylesheetsPipeline;
