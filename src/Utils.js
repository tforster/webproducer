("use strict");

// System dependencies (Built in modules)

const path = require("path");
const { promises: fs } = require("fs");

// Third party dependencies (Typically found in public NPM packages)
const mime = require("mime/lite");

/**
 * Implements some simple static methods shared across the codebase
 * @class Utils
 */
class Utils {
  /**
   * Empties the specified directories by recursively removing everything and then force recreating
   * @static
   * @param {string[]} directories: Array of relative paths
   * @returns A Promise
   * @memberof Utils
   */
  static async emptyDirectories(directories) {
    if (!Array.isArray(directories)) {
      directories = [directories];
    }
    return Promise.all(directories.map((directory) => fs.rmdir(directory, { recursive: true })));
  }

  /**
   * Returns the mimetype matching the supplied extension. Empty extensions are presumed to come from .html slugs.
   * @static
   * @param {string} ext: The extension, if available, to lookup the mime type for
   * @returns {string}:   The corresponding mimetype, or text/html if no extension was provided.
   * @memberof Utils
   */
  static getMimeType(path) {
    const mimeType = mime.getType(path);
    return mimeType || "text/html";
  }

  /**
   * Parses the supplied data object into a Vinyl-like structure that can be used with the Vinyl constructor later
   *
   * @static
   * @param {object} fileDescriptor:  A data object typically obtained from config.yml describing a source or destination
   * @returns
   * @memberof Utils
   */
  static vinylise(fileDescriptor) {
    const vinylize = {
      type: fileDescriptor.type,
      path: fileDescriptor.path.toLowerCase(),
    };

    switch (vinylize.type) {
      case "graphql":
        break;
      case "s3":
        vinylize.region = fileDescriptor.region;
        const u = new URL(vinylize.path);
        vinylize.bucket = u.host;
        vinylize.path = u.pathname.slice(1); // S3 keys are not rooted at /. E.g. there is no leading / in an S3 key.
        break;
      case "filesystem":
        vinylize.path = path.resolve(vinylize.path);
        break;
      default:
    }

    // Calculate the Vinyl base.
    // ToDo: Determine if this is needed when we create legit Vinyl file
    //vinylize.base = path.dirname(vinylize.path);
    // Setting to path for now since S3 from Yaml should be specifiying that
    vinylize.base = vinylize.path;

    // Use RegEx to determine if last path segment is a filename (at least one "." must be present)
    const matches = vinylize.path.match(/\/[^.^\/]*$/g);
    if (matches) {
      // Is a directory
      vinylize.stat = { mode: 16384 };
    } else {
      // Is a file
      vinylize.stat = { mode: 32768 };
      vinylize.filename = path.basename(vinylize.path);
    }

    return vinylize;
  }
}

module.exports = Utils;
