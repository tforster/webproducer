// System dependencies
import { Writable } from "stream";
import { Readable } from "stream";

// Third party dependencies
import handlebars from "handlebars";
import { minify as htmlMinify } from "html-minifier";
import { log, streamsFinish, vinyl } from "./Utils.js";
import mime from "mime";

// TODO: 1. Expect dataStream to be type object of individual URI objects;
// TODO: 2. Wait for themeStream to complete loading to memory and THEN pipe dataStream to themeStream

class TemplatePipeline {
  // Private properties
  #options;
  #dataStreamR;
  #themeStreamR;

  /**
   * Creates an instance of TemplatePipeline.
   * @param {object} options: Hash of runtime options
   * @memberof TemplatePipeline
   */
  constructor(options, dataStreamR, themeStreamR) {
    this.#options = options;
    this.#dataStreamR = dataStreamR;
    this.#themeStreamR = themeStreamR;

    // Create a new Readable stream as pipable output
    this.stream = new Readable({
      objectMode: true,
      read: function (f) {
        this.push(null);
      },
    });
  }

  /**
   * @description
   * @return {stream}:  A steam of Vinyl files
   * @memberof TemplatePipeline
   */
  async prep() {
    const { data, templates } = await this.parseFiles();
    this.data = data;
    this.templates = templates;
  }

  /**
   * @description: Builds files by combining templates and data
   * @return {void}:
   * @memberof TemplatePipeline
   */
  build() {
    const data = this.data;
    const templates = this.templates;

    // Check for data and exit if non present
    if (!data.uris) {
      const msg = "TemplatePipeline: Empty or missing data.uris.";
      console.warn(msg);
      throw msg;
    }

    handlebars.partials = templates;
    // Iterate the uris sub object of data
    for (const [key, uri] of Object.entries(data.uris)) {
      // Check that we have a page and webProducerKey otherwise gracefully exit this specific iteration
      if (!uri?.webProducerKey) {
        console.warn(`Unexpected condition: webProducerKey not found processing [${key}, ${uri}]`);
        continue;
      }

      // Cleanup any accidental whitespace
      const path = key.trim();
      // Declare a placeholder for the Vinyl file that will be generated
      let vinylFile;

      // Get the template referenced by the webProducerKey
      const template = templates[`${uri.webProducerKey}.hbs`];

      if (template) {
        // Generate content by merging the pageData into the named Handlebars template
        const generatedContents = template(uri);

        // Create a new Vinyl object from the generated data
        vinylFile = vinyl({
          path,
          contents: Buffer.from(generatedContents),
          contentType: mime.getType(path),
        });

        if (vinylFile.extname === "" || vinylFile.extname === ".html") {
          // This generated file in HTML and the contents should be minified
          vinylFile.contents = Buffer.from(
            htmlMinify(vinylFile.contents.toString(), { collapseWhitespace: true, removeComments: true })
          );
          // Force extensionless to HTML mime type
          vinylFile.contentType = "text/html";
        }
      } else if (uri.webProducerKey === "redirect") {
        // Redirects are pseudo-virtual text files that are not created via a handlebars template
        vinylFile = vinyl({
          path,
          contents: Buffer.from(uri.targetAddress),
          redirect: 301,
          // Note: AWS S3 will convert this to the specific header x-amz-website-redirect-location
          // targetAddress: uri.targetAddress,
          contentType: "text/html",
        });
      } else {
        log(`Unexpected condition: page and webProducerKey not found. ${key}, ${uri}`);
        continue;
      }

      // Add the vinyl file to the mergeStream
      this.stream.push(vinylFile);
    }
  }

  /**
   * @description:  Parses out the data as a file from dataStreamR and, compiles all the handlebars templates found in themeStreamR.
   * @return {object}:  An object containing a data property and a compiled handlebars templates property
   * @memberof TemplatePipeline
   */
  async parseFiles() {
    // Cache the streams to make them easier to reference in this method
    const dataStreamR = this.#dataStreamR;
    const themeStreamR = this.#themeStreamR;

    // Declare the in-memory objects to be returned
    const templates = {};
    let data = {};

    // Add event handlers to the streams. Currently empty but kept for possible future use.
    dataStreamR.on("end", () => {});
    themeStreamR.on("end", () => {});

    // Process the theme stream to build an in-memory array of compiled handlebars templates
    const themeStreamW = new Writable({
      objectMode: true,
      write: (file, _, done) => {
        // Compile the theme file into the handlebars.templates hash
        templates[file.relative] = handlebars.compile(file.contents.toString());
        done();
      },
    });

    // Process the data stream to create an in-memory data object
    const dataStreamW = new Writable({
      objectMode: true,
      write: (file, _, done) => {
        // TODO: Improve handling in case we get non JSON data for some reason
        let rawData = "";

        if (file.contents) {
          // A Vinyl file object will have a .contents property
          rawData = file.contents.toString();
        } else {
          // A non Vinyl file, e.g. result of a fetch() response, should be a vanilla buffer
          rawData = file.toString();
        }

        try {
          data = JSON.parse(rawData);
        } catch (err) {
          console.warn("Unexpected condition: Valid JSON not found.\n", rawData);
          data = {};
        }

        done();
      },
    });

    // Start piping both in parallel
    dataStreamR.pipe(dataStreamW);
    themeStreamR.pipe(themeStreamW);

    // Allow all the streams to finish processing before returning
    await streamsFinish([dataStreamW, themeStreamW]);

    // Cleanup
    dataStreamR.unpipe(dataStreamW);
    themeStreamR.unpipe(themeStreamW);

    return { data, templates };
  }
}

export default TemplatePipeline;
