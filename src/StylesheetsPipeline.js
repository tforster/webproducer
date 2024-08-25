// System dependencies
import { Readable } from "stream";

// Third party dependencies
import { build } from "esbuild";
import autoprefixer from "autoprefixer";
import postcss from "postcss";

// Project dependencies
import { vinyl } from "./Utils.js";

/**
 * @description: A Gilbert pipeline that takes in a stream of css files and pipes them through the esbuild bundler for optimisation.
 * @class StylesheetsPipeline
 */
export default class StylesheetsPipeline {
  // Private properties
  #options;
  #entryPoints;

  /**
   * Creates an instance of StylesheetsPipeline.
   * @param {object} options: Hash of runtime options
   * @memberof StylesheetsPipeline
   */
  constructor(options, entryPoints) {
    this.#options = options;
    this.#entryPoints = entryPoints;

    this.stream = new Readable({
      objectMode: true,
      read: function (f) {
        this.push(null)
      },
    })    
  }

  /**
   * @description
   * @param {*} mergeStream
   * @param {*} entryPoints
   * @return {*}  
   * @memberof StylesheetsPipeline
   */
  async build() {
    try {
      const result = await build({
        entryPoints: this.#entryPoints,
        outdir: "/",
        bundle: true,
        sourcemap: true,
        target: ["es2020"],
        minify: true,
        write: false,
        metafile: true,
        loader: { ".eot": "file", ".ttf": "file", ".woff": "file", ".svg": "file" },
      });

      // Iterate through the output files and push them to the mergeStream
      for (const out of result.outputFiles) {
        const path = out.path;
        let contents;

        // Check for any required auto prefixing
        if (path.endsWith(".css") && this.#options?.autoprefixCss) {
          contents = Buffer.from(await this.#autoPrefix(out.text));
        } else {
          contents = Buffer.from(out.contents);
        }

        // Create a virtual file object
        const v = vinyl({
          path,
          contents,
        });

        // Add the virtual file object to the merge stream
        this.stream.push(v);
      }

      // Return a done message, or additional stats if requested
      if(this.#options?.stats){
        return `Stylesheets: ${JSON.stringify(result.metafile)}`;
      } else {
        return `Stylesheets built`;
      }
    } catch (err) {
      console.error("Error in StyleSheetsPipeline.js", err);
      throw err;
    }
  }

  /**
   * @description: Wrapper around the autoPrefix function from autoprefixer depedency. Also requires postcss dependency
   * @param {string} css: The css to be autoprefixed
   * @return {string}     The autoprefixed css
   * @memberof StylesheetsPipeline
   */
  #autoPrefix(css) {
    // Only require if we choose to enable auto prefixing
    return postcss([autoprefixer])
      .process(css)
      .then((result) => {
        return result.css;
      });
  }
}

