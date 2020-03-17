("use strict");

// System dependencies (Built in modules)
const Module = module.constructor;
const { Writable } = require("stream");

// Third party dependencies (Typically found in public NPM packages)
const fetch = require("node-fetch");

/**
 * ToDo: data() and _fetchData() can be better organised now they've been merged into the same module
 *
 * @class GraphQLDataProvider
 */
class GraphQLDataProvider {
  /**
   * Fetch wrapper around the provided GraphQL endpoint and GraphQL query
   * @static
   * @param {hash} options:     Includes GraphQL endpoint, DatoCMS token, etc
   * @param {boolean} preview:  True to retrieve unpublished (aka draft) content
   * @returns
   * @memberof GraphQLDataProvider
   */
  static async _fetchData(options) {
    // Construct the URL for preview vs published. GraphQL endpoint of "/" = published, "/preview" includes drafts
    const url = new URL(options.endpoint);
    // Default preview to false to prevent accidental leakage of unpublished content
    options.preview = options.prevew || false;
    if (options.preview) {
      url.pathname = "preview";
    }

    try {
      // Execute the request
      const response = await fetch(url.href, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${options.token}`,
        },
        body: JSON.stringify({
          query: options.query,
        }),
      });

      const result = await response.json();

      if (result.errors) {
        console.log("GraphQLDataProvider.data errors");
        throw result;
      } else if (result.data) {
        let data = result.data;

        if (options.transform) {
          const module = new Module();
          module._compile(options.transform, "transform.js");
          data = module.exports(data);
        }

        return data;
      }
    } catch (err) {
      console.error("GraphQLDataProvider.data error", err);
      throw err;
    }
  }

  /**
   * Returns transformed, template ready data from the CMS
   * - fetches the contents of the db folder
   * - calls the CMS endpoint with the db query to get the raw data
   * - transforms the raw data with the db transform function
   * @param {stream.Readable}:  sourceStream from which to fetch the db folder
   * @returns:                  Data
   * @memberof WebProducer
   */
  static async data(sourceStream, options) {
    return new Promise((resolve) => {
      const dataFiles = {};

      try {
        const writable = new Writable({
          objectMode: true,
        });

        writable._write = function(file, _, done) {
          dataFiles[file.basename] = file.contents.toString();
          done();
        };

        writable.on("error", (err) => {
          console.error("data():", err);
        });

        writable.on("finish", async () => {
          // 1.fetch query
          const graphQLOptions = {
            query: dataFiles["query.graphql"],
            endpoint: "https://graphql.datocms.com/",
            transform: dataFiles["transform.js"],
            token: options.datoCMSToken,
            preview: options.preview,
          };

          try {
            var data = await GraphQLDataProvider._fetchData(graphQLOptions);
            return resolve(data);
          } catch (err) {
            console.error("_fetchData():", err);
            throw err;
          }
        });

        sourceStream.pipe(writable);
      } catch (err) {
        console.log(err);
        throw err;
      }
    });
  }
}

module.exports = GraphQLDataProvider;
