("use strict");

// System dependencies (Built in modules)
//const { Duplex } = require("stream");
const { Readable, Writable } = require("stream");

// Third party dependencies (Typically found in public NPM packages)
const AWS = require("aws-sdk");
const micromatch = require("micromatch");
const Vinyl = require("vinyl");

/**
 * Implements Gulp-like dest() function to terminate a piped process by uploading the supplied Vinyl file to AWS S3
 * @class VinylS3
 */
class VinylS3 {
  /**
   * Creates an instance of VinylS3.
   * @param {*} options
   * @memberof VinylS3
   */
  constructor(options) {
    // Set objectMode true as we are processing whole Vinyl files, not chunks of a single file
    this.options = options;
    this.s3 = new AWS.S3({ region: options.region });
  }


  /**
   * 
   *
   * @param {*} globs
   * @param {*} relativePath
   * @returns
   * @memberof VinylS3
   */
  src(globs, relativePath) {
    //const self = this;//
    const self = new VinylS3(this.options);
    self.keys = null;

    // Call our override method
    return self._src(globs, relativePath);
  }

  /**
   * 
   * Stream Vinyl files FROM an S3 bucket
   *
   * @param {*} globs
   * @returns
   * @memberof VinylS3
   */
  _src(globs, relativePath) {
    const self = this;

    self.globs = globs;
    // If present, is the relativePath segment to remove
    self.relativePath = relativePath;

    const readable = new Readable({ objectMode: true, highWaterMark: 64 });

    readable._read = async function () {
      if (!self.keys) {
        // First time here, let's seed the keys array with data from S3 source
        try {
          // Get list of all key objects
          // ! Max is 1000. This code does not handle > 1000 keys at this time
          self.keys = (await self.s3.listObjectsV2({ Bucket: self.options.bucket }).promise()).Contents;
          // Map to remove extraneous properties and get us to an array of just Keys
          self.keys = self.keys.map((key) => key.Key);
          // Filter the list of Keys based on the glob
          self.keys = micromatch(self.keys, self.globs);
        } catch (err) {
          console.error(`Vinyl-S3 Error ${err.code}`);
          switch (err.code) {
            case "NoSuchBucket":
              console.error("ERR: Bucket not found", self.options.Bucket, self.options.region);
              break;
            case "AccessDenied":
              throw err;
            default:
              console.error("ERR: Bucket error to be added to s3._read", self.options.Bucket, self.options.region);
          }
          throw err;
        }
      }

      // If there are no more keys then push null to signal the end of the stream
      if (self.keys.length === 0) {
        readable.push(null);
        self.keys = null;
        return;
      }

      // Pop the oldest key off the top of the array FIFO style
      const key = self.keys.pop();

      // Start creating our Vinyl object params. Remove any prefix path like stage or prod
      const regex = new RegExp(`^${self.relativePath}`);
      const vinylParams = { path: key.replace(regex, "") };

      // Fetch the data from S3
      try {
        const s3Object = await self.s3
          .getObject({
            Bucket: self.options.bucket,
            Key: key,
          })
          .promise();

        // Set the directory or file details, as determined by the key, in our Vinyl object params
        if (key.match(/\/$/) > "") {
          // Is directory so set mode and leave contents as null
          vinylParams.stat = { mode: 16384 };
        } else {
          // Is file, so set contents
          vinylParams.contents = Buffer.from(s3Object.Body);
        }
        // Create a new Vinyl object
        const vinyl = new Vinyl(vinylParams);

        // Push the Vinyl object into the stream
        readable.push(vinyl);
      } catch (err) {
        console.error("Vinyl-s3._read()", err, key, vinylParams);
        throw err;
      }
    };

    return readable;
  }

  /**
   * Stream Vinyl files TO an S3 bucket
   *
   * @returns
   * @memberof VinylS3
   */
  dest() {
    const _this = this;
    const options = _this.options;

    this.writable = this.writable || new Writable({ objectMode: true });

    this.writable._write = function (file, _, done) {
      const params = {
        Bucket: options.Bucket,
        Key: options.key || file.basename,
        Body: file.contents,
        ACL: "public-read",
      };

      // Stream the provided file to the S3 bucket and key
      try {
        _this.s3
          .upload(params)
          .promise()
          .then(() => {
            done();
          })
          .catch((reason) => {
            console.error("VinylS3.dest:s3.upload:", reason);
            throw reason;
          });
      } catch (err) {
        console.error("s3._write error", err);
        throw err;
      }
    };

    // this.writable.on("finish", () => {
    //   console.log("FINISH");
    // });

    return this.writable;
  }
}

module.exports = VinylS3;
