// System dependencies
const { Writable } = require("stream");

// Third party dependencies
const vfs = require("vinyl-fs");

// Project dependencies
const GraphQLDataAdapter = require("./GraphQLDataAdapter");
const Utils = require("../Utils");
const s3FileAdapter = require("./S3FileAdapter");

/**
 * Note that while the majority of WebProducer is heavily streams focused we don't return a stream for the data source. This is
 * because data needs to be randomly accessible by the page builder based on the order of .hbs templates that are streamed.
 *
 * @class DataSource
 */
class DataSource {
  /**
   * Returns the complete site data
   * - options.snapshot is used by non-filesystem types (e.g. GraphQL, GET, SQL and Mongo) to store a snapshot in path/data.json
   *
   * @static
   * @param {object} options: A set of properties that describe the data source, its type, path and custom meta information
   * @returns:                An object containing the site data, optionally reshaped if required.
   * @memberof DataSource
   */
  static async data(options) {
    let data = {};

    // Attempt to get any query, transform or data from the path if it was provided.
    const { query, json } = await DataSource._getMeta(options.path, options.region);

    const type = options.endpoint ? options.endpoint.type : options.type;

    // Fetch the data based on the type of data source
    switch (type) {
      case "graphql":
        if (!query) {
          throw new Error("A query is required for type GraphQL");
        }
        if (!options.endpoint.token || options.endpoint.token === "undefined") {
          throw new Error("An auth token is required for type GraphQL");
        }

        // Return the results of a GraphQL query against the endpoint
        data = await GraphQLDataAdapter.data(options.endpoint.base, query, options.endpoint.token, options.endpoint.published);
        break;

      case "filesystem":
        // Shortcut from DataSource._getMeta() function above so we don't make a second unnecessary round trip
        data = json;
        break;

      case "s3":
        // Shortcut from DataSource._getMeta() function above so we don't make a second unnecessary round trip
        data = json;
        break;

      case "get":
        throw new Error(`Data source type GET is not implemented yet.`);

      case "sql":
        throw new Error(`Data source type SQL is not implemented yet.`);
      case "mongo":
        throw new Error(`Data source type MongoDb is not implemented yet.`);
      default:
        throw new Error(`Data source type ${type} is not supported.`);
    }

    // If the developer passed the snapshot option into main() then generate a JSON file of these results.
    if (options.snapshot) {
      await Utils.saveFile(JSON.stringify(data), "snapshot.json", options.path);
    }

    // Optionally reshape the data if a transform module was provided
    if (options.TransformModule) {
      data = new options.TransformModule().transform(data);
    }

    // Final check to ensure we have data
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      throw new Error("Data not found.");
    }

    // Return the data to the main() in index.js
    return data;
  }

  /**
   * Returns any meta files associated with the data source including none, one or all of a query and transform function.
   *
   * @static
   * @param {string} path:        The absolute, relative or S3 path to the folder containing meta files
   * @param {string} region:      Optional AWS region if path is an S3 bucket
   * @returns {query, transform}: A Promise that resolves to an object containing query and transform sub objects
   * @memberof DataSource
   */
  static async _getMeta(path, region) {
    if (!path) {
      // No meta path was provided ergo no need to try and fetch any meta files
      return;
    }

    // Create a temporary stream to read the meta files
    let stream;

    // Identify the type of filesystem hosting the meta files
    const metaType = Utils.identifyFileSystem(path);

    if (metaType === "file") {
      stream = vfs.src(`${path}/data/**/*.*`);
    } else if (metaType === "s3") {
      const v = Utils.vinylise2(path);
      stream = new s3FileAdapter({ bucket: v.bucket, region }).src(`${v.path}/data/**/*.*`);
    } else {
      throw new Error(`Meta type ${metaType} is not supported`);
    }

    // _getFilesFromStream returns a Promise
    return DataSource._getFilesFromStream(stream);
  }

  /**
   * Gets the contents of the data directory passed in the stream
   *
   * @param {Readable stream} metaDataStream: A readable object stream containing the files from the filesystem or S3 as requested
   * @returns {query, transform}: A Promise that resolves to an object containing query and transform sub objects
   * @memberof DataSource
   */
  static _getFilesFromStream(metaDataStream) {
    if (!metaDataStream) {
      throw new Error("Invalid or missing stream in _getFilesFromStream");
    }

    return new Promise((resolve) => {
      const metaDataFiles = {};

      // Create a Writable stream to consume the incoming dataSourceStream
      const writable = new Writable({
        objectMode: true,
      });

      // Add some meta to make it easier to branch for json, graphql, transform, etc
      writable._write = function (file, _, done) {
        switch (file.extname) {
          case ".json":
            metaDataFiles["json"] = JSON.parse(file.contents);
            break;

          case ".graphql":
            metaDataFiles["query"] = file.contents.toString();
            break;

          case ".sql":
            metaDataFiles["query"] = file.contents.toString();
            break;

          default:
            throw new Error("Unsupported file type in DataSource");
        }
        done();
      };

      // Wrap and throw any errors
      writable.on("error", (err) => {
        // eslint-disable-next-line no-console
        console.error("data():", err);
        throw new Error(err);
      });

      // Resolve our Promise when the stream is done
      writable.on("finish", () => resolve(metaDataFiles));

      // Start streaming
      metaDataStream.pipe(writable);
    });
  }
}

module.exports = DataSource;
