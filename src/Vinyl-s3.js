("use strict");

// System dependencies (Built in modules)
const { Readable, Writable } = require("stream");

// Third party dependencies (Typically found in public NPM packages)
const AWS = require("aws-sdk");
const micromatch = require("micromatch");
const Vinyl = require("vinyl");

const Utils = require("./Utils");

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
   * @returns
   * @memberof VinylS3
   */
  src(globs) {
    //const self = this;//
    const self = new VinylS3(this.options);
    self.keys = null;

    // Call our override method
    return self._src(globs);
  }

  /**
   * 
   * Stream Vinyl files FROM an S3 bucket
   *
   * @param {*} globs
   * @returns
   * @memberof VinylS3
   */
  _src(globs) {
    const self = this;

    // Convert single string globs to an array
    if (!Array.isArray(globs)) {
      globs = [globs];
    }

    const readable = new Readable({ objectMode: true, highWaterMark: 64 });
    readable._read = async function () {
      if (!self.keys) {
        // First time here, let's seed the keys array with data from S3 source

        try {

          // Get list of all key objects 
          // ! Max is 1000. This code does not handle > 1000 keys at this time but Prefix filtering should get us a long way.
          self.keys = (await self.s3.listObjectsV2({
            Bucket: self.options.bucket,  // Bucket name originally from the constructor 
            Prefix: self.options.base     // Use the base as a prefix to filter. E.g. prefix = /src/stage
          }).promise()).Contents;

          // Map to remove extraneous properties and get us to an array of just Keys
          self.keys = self.keys.map((key) => key.Key);

          // Filter the list of Keys based on the glob
          self.keys = micromatch(self.keys, globs);

        } catch (err) {
          switch (err.code) {
            case "NoSuchBucket":
              console.error("ERR: Bucket not found", self.options.bucket, self.options.region);
              break;
            case "AccessDenied":
              console.error("ERR: Bucket access denied", self.options.bucket)
              throw err;
            default:
              console.error("ERR: Bucket error to be added to s3._read", self.options.bucket, self.options.region);
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

      // Start creating our Vinyl object params. Remove any prefix path like /src/stage or /dist/prod
      const prefix = new RegExp(`^${self.options.base}/`);
      const vinylParams = { path: key.replace(prefix, "") };

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
   */


  /**
   * Allows a readable stream to upload files to S3 for web serving
   *
   * @static
   * @param {object} config:      The parsed S3 data from config.yml
   * @param {string} [folder=""]: The optional folder in the S3 bucket to write to (e.g. /dist/prod, etc)
   * @returns {WritableStream}:   A writeable stream 
   * @memberof VinylS3
   */
  static dest(config, folder = "") {

    const Bucket = config.bucket;
    const s3 = new AWS.S3({ region: config.region });

    return new Writable({
      objectMode: true,

      write: async function (file, _, done) {
        // Construct the slug, aka Key because we pass it to the S3 upload() method.
        const Key = require("path").join(folder, file.relative);

        // Get the Content-Type. Note that extensionless files automatically return text/html
        const ContentType = Utils.getMimeType(file.extname)

        console.log(Key);

        const params = {
          Bucket,
          Key,
          Body: file.contents,
          ACL: "public-read",
          ContentType
        };

        await s3
          .upload(params)
          .promise()
          .catch((reason) => {
            console.error("VinylS3.dest:s3.upload:", reason);
            throw reason;
          });
        done();
      }
    });
  }


}

module.exports = VinylS3;
