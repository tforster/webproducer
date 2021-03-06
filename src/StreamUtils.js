("use strict");

// System dependencies (Built in modules)
const crypto = require("crypto");
const { Transform, Writable } = require("stream");

// Project dependencies
const Utils = require("./Utils");

/**
 * A transform stream to prepare files for web serving by setting headers and configuring slug extenions
 * @class StreamUtils
 */
class StreamUtils {
  /**
   *Creates an instance of StreamUtils.
   * @memberof StreamUtils
   */
  constructor() {
    // Set up object/arrays to track files of various states
    this.destinationReads = {};
    this.destinationDeletes = [];
    this.destinationUpdates = [];
    this.destinationCreates = [];
  }

  /**
   * NOT CURRENTLY IN USE
   *
   * A transform stream intended to rewrite the path portion of a Vinyl file object
   * - Was started to answer the question of moving generated scripts from scripts folder to root but abandoned in favour of
   *   improved Vinyl file creation in VinylS3
   * - In early testing it worked, however it rewrote the entire path rather than the path upto but not including the filename
   *
   * @static
   * @param {*} newPath
   * @returns
   * @memberof StreamUtils
   */
  static mv(newPath) {
    const transform = new Transform({
      objectMode: true,
      transform: function (vinylFile, _, done) {
        console.log(`${new Date().toISOString()}> Moved ${vinylFile.path} to ${newPath} for ${vinylFile.basename}`);
        vinylFile.path = newPath;
        done(false, vinylFile);
      },
    });

    transform.on("error", (err) => {
      throw new Error(err);
    });

    transform.on("finish", () => { });

    return transform;
  }

  /**
   * Get the MD5 hash of the fileContents. Note that we opted for MD5 as that is already in use by S3.
   * @static
   * @param {ArrayBuffer} fileContents: Typically found as .contents from a ReadableStream where objectMode = true;
   * @returns:                          A MD5 hash of the file contents
   * @memberof Utils
   */
  _getFileHash(fileContents) {
    const shasum = crypto.createHash("md5");
    shasum.update(fileContents);
    return shasum.digest("hex");
  }

  /**
   * Helper function to set various additional properties on a VinylFile
   *
   * - Vinyl provides an isDirectory() function with some odd conditions. Since we are dealing with some files with empty contents
   *   we cannot use isDirectory().
   *
   * @static
   * @param {*} vinylFile
   * @param {*} options
   * @returns
   * @memberof StreamUtils
   */
  _setProperties(vinylFile, options) {
    if (vinylFile.contents) {
      // .HTML extension
      if (options.setHttpExtension) {
        if (vinylFile.extname === "") {
          vinylFile.extname = ".html";
        }
      }

      // ContentType
      if (options.setContentTypeHeader) {
        vinylFile.contentType = Utils.getMimeType(vinylFile.basename);
      }

      // ETag. vinylFiles created from S3.headObject() will have the eTag already set
      if (options.setHash && !vinylFile.eTag) {
        vinylFile.eTag = this._getFileHash(vinylFile.contents);
      }

      // Size (should be content-length?) vinylFiles created from S3.headObject() will have the eTag already set
      if (options.setFileSize && !vinylFile.size) {
        vinylFile.size = vinylFile.contents.length;
      }
    }

    return vinylFile;
  }

  /**
   * Parses the stream containing current state of destination to build an array of hashes required to calculate synchronisation
   *
   * @static
   * @param {StreamReadable} destinationStream: Stream containing all the current files that exist in the destination prior to build
   * @param {*} options
   * @returns
   * @memberof StreamUtils
   */
  parseDestinationFiles(destinationStream) {
    const self = this;

    return new Promise((resolve) => {
      // Parse the stream and resolve when it is done
      const writable = new Writable({
        objectMode: true,
        write: function (vinylFile, _, done) {
          // Set the various properties on the vinyl file
          vinylFile = self._setProperties(vinylFile, { setHash: true, setFileSize: true });

          // Add a "lite" vinyl object to the array so we can track path, hash, size and whether it is a file or directory
          const { relative, eTag, size, directory = vinylFile.isDirectory() } = vinylFile;
          self.destinationReads[relative] = { relative, eTag, size, directory };
          done(false, vinylFile);
        },
      });

      // Resolve the (optional) array of handles
      writable.on("finish", function () {
        return resolve(self.destinationReads);
      });

      // Setup an error handler
      writable.on("error", function (err) {
        throw err;
      });

      // Start the pipe flowing
      destinationStream.pipe(writable);
    });
  }

  /**
   * @returns:  a stream just the vinylFiles that need to be updated (VFS and S3)
   * @memberof StreamUtils
   */
  filterDeployableFiles() {
    const self = this;

    const transform = new Transform({
      objectMode: true,
      transform: function (vinylFile, _, done) {
        vinylFile = self._setProperties(vinylFile, { setContentTypeHeader: true, setHash: true });
        const { relative, eTag } = vinylFile;

        if (self.destinationReads[relative]) {
          // vinylFile pre-exists
          if (self.destinationReads[relative].eTag !== eTag) {
            // vinylFile is different than the original
            self.destinationUpdates.push(relative);
            console.log(`${new Date().toISOString()}> Update:      ${relative}`);
            done(false, vinylFile);
          } else {
            done(false);
          }
        } else {
          // vinylFile is new
          self.destinationCreates.push(relative);
          console.log(`${new Date().toISOString()}> Create:      ${relative}`);
          done(false, vinylFile);
        }
      },
    });

    transform.on("error", (err) => {
      throw new Error(err);
    });

    transform.on("finish", () => {
      console.log(`${new Date().toISOString()}> Finished filtering deployable files.`);
    });

    return transform;
  }
}

module.exports = StreamUtils;
