("use strict");

// System dependencies (Built in modules)
const crypto = require("crypto");
const { Transform, Readable, Writable } = require('stream');

// Third party dependencies (Typically found in public NPM packages)

// Project dependencies
const Utils = require("./Utils");

/**
 * A transform stream to prepare files for web serving by setting headers and configuring slug extenions
 *
 * @class Webify
 */
class Metafy {
  constructor() {

    this.destinationReads = {};
    this.destinationDeletes = [];
    this.destinationUpdates = [];
    this.destinationCreates = [];
  }

  /**
   * Get the SHA1 hash of the fileContents
   * @static
   * @param {ArrayBuffer} fileContents: Typically found as .contents from a ReadableStream where objectMode = true;
   * @returns:                          A SHA1 hash of the file contents
   * @memberof Utils
   */
  _getFileHash(fileContents) {
    const shasum = crypto.createHash("sha1");
    shasum.update(fileContents);
    return shasum.digest("hex");
  }


  /**
   * Helper function to set various additional properties on a VinylFile
   *
   * @static
   * @param {*} vinylFile
   * @param {*} options
   * @returns
   * @memberof Metafy
   */
  _setProperties(vinylFile, options) {

    if (!vinylFile.isDirectory()) {
      if (options.setHttpExtension) {
        if (vinylFile.extname === "") {
          vinylFile.extname = ".html";
        }
      }

      if (options.setContentTypeHeader) {
        vinylFile.contentType = Utils.getMimeType(vinylFile.basename);
      }

      if (options.setHash) {
        vinylFile.hash = this._getFileHash(vinylFile.contents);
      }

      if (options.setFileSize) {
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
   * @memberof Metafy
   */
  parseDestinationFiles(destinationStream) {
    const handles = [];
    const self = this;

    return new Promise((resolve, reject) => {
      // Parse the stream and resolve when it is done
      const writable = new Writable({
        objectMode: true,
        write: function (vinylFile, _, done) {
          // Set the various properties on the vinyl file
          vinylFile = self._setProperties(vinylFile, { setHash: true, setFileSize: true });

          // Add a "lite" vinyl object to the array so we can track path, hash, size and whether it is a file or directory
          const { relative, hash, size, directory = vinylFile.isDirectory() } = vinylFile;
          self.destinationReads[relative] = { relative, hash, size, directory };

          //console.log(path, hash, size, directory)
          done(false, vinylFile);
        }
      });

      // Resolve the (optional) array of handles
      writable.on("finish", function () {
        console.log("Finished", self.destinationReads)
        return resolve(self.destinationReads);
      });

      // Setup an error handler
      writable.on("error", function (err) {
        console.log("error")
        throw err
      });

      // Start the pipe flowing
      destinationStream.pipe(writable);
    })
  }


  // Returns a stream just the vinylFiles that need to be updated (VFS and S3)
  resolveUpdates() {
    const self = this;

    const transform = new Transform({
      objectMode: true,
      transform: function (vinylFile, _, done) {
        vinylFile = self._setProperties(vinylFile, { setContentTypeHeader: true, setHash: true })
        const { relative, hash } = vinylFile;
        //        console.log(relative)
        if (self.destinationReads[relative]) {
          // vinylFile pre-exists
          if (self.destinationReads[relative].hash !== hash) {
            // vinylFile is different than the original
            self.destinationUpdates.push(relative);
            console.log("UPDATE:", relative, self.destinationReads[relative].hash, hash)
            done(false, vinylFile)
          } else {
            // 
            done(false);
          }
        } else {
          // vinylFile is new
          self.destinationCreates.push(relative);
          console.log("CREATE:", relative)
          done(false, vinylFile);
        }
      }
    });

    transform.on("error", (err) => {
      console.error(err);
    });

    transform.on("finish", () => {
      // console.log("finished resolving and deploy changes.")
      // console.log(this.destinationUpdates)
      // console.log(this.destinationCreates)
    });

    transform.on("close", () => {
      console.log("CLSOE")
    })
    return transform;
  }



  // Returns the list of destination files to be deleted (VFS and S3)
  resolveDeletes() {

  }

  // Returns the list of paths to send to CloudFront to invalidate (S3+CloudFront only)
  resolveInvalidations() {

  }




}

module.exports = Metafy;
