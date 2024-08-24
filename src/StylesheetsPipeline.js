// Third party dependencies

import { build } from "esbuild";
import autoprefixer from "autoprefixer";
import postcss from "postcss";

// Project dependencies
import { vinyl } from "./Utils.js";

class StylesheetsPipeline {
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
    // TODO: Remove non-CSS build() options
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
      loader: { ".eot": "file", ".ttf": "file", ".woff": "file", ".svg": "file" },
    });

    for (const out of result.outputFiles) {
      const path = out.path;
      let contents;

      if (path.endsWith(".css") && this.options?.autoprefixCss) {
        // Optionally prefix the css
        contents = Buffer.from(await this.autoPrefix(out.text));
      } else {
        contents = Buffer.from(out.contents);
      }

      const v = vinyl({
        path,
        contents,
      });
      mergeStream.push(v);
    }

    const retVal = "stylesheets done";
    return retVal;
  }

  autoPrefix(css) {
    // Only require if we choose to enable auto prefixing
    return postcss([autoprefixer])
      .process(css)
      .then((result) => {
        result.warnings().forEach((warn) => {
          // TODO: Tuck this behind a flag so that the developer has to specify if they want visible warnings in their output.
          console.warn(warn.toString());
        });
        return result.css;
      });
  }
}

export default StylesheetsPipeline;
