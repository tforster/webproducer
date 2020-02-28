("use strict");

// System dependencies (Built in modules)
const { Duplex } = require("stream");

// Third party dependencies (Typically found in public NPM packages)
const AWS = require("aws-sdk");
const Vinyl = require("vinyl");

/**
 * Implements Gulp-like dest() function to terminate a piped process by uploading the supplied Vinyl file to AWS S3
 * @class VinylS3
 */
class VinylS3 extends Duplex {
  /**
   * Creates an instance of VinylS3.
   * @param {*} options
   * @memberof VinylS3
   */
  constructor(options) {
    // Set objectMode true as we are processing whole Vinyl files, not chunks of a single file
    super({ objectMode: true });
    this.options = options;
    console.log("VinylS3.constructor:", options);

    this.s3 = new AWS.S3({ region: options.region });
  }

  /**
   * Extends stream read() with our custom logic
   * ToDo: Improve performance by pushing multiple objects up to the highwater mark by wrapping the boolean response from _this.push()
   * @memberof VinylS3
   */
  async _read() {
    const _this = this;
    if (!this.keys) {
      // First time here, let's seed the keys array with data from S3 source
      this.keys = (await this.s3.listObjectsV2({ Bucket: this.options.templatesBucket }).promise()).Contents;
    }

    // If there are no more keys then push null to signal the end of the stream
    if (this.keys.length === 0) {
      _this.push(null);
      return;
    }

    // Pop the oldest key off the top of the array FIFO style
    const key = this.keys.pop().Key;
    // Start creating our Vinyl object params
    const vinylParams = { path: key };

    // Fetch the data from S3
    const s3Object = await this.s3
      .getObject({
        Bucket: this.options.templatesBucket,
        Key: key,
      })
      .promise();

    // Set the directory or file details, as determined by the key, in our Vinyl object params
    if (key.match(/\/$/)) {
      // Is directory so set mode and leave contents as null
      vinylParams.stat = { mode: 16384 };
    } else {
      // Is file, so set contents
      vinylParams.contents = Buffer.from(s3Object.Body);
    }
    // Create a new Vinyl object
    const vinyl = new Vinyl(vinylParams);

    // Push the Vinyl object into the stream
    _this.push(vinyl);
  }

  /**
   * Extends stream write() with our custom logic
   * @param {*} file
   * @param {*} _
   * @param {*} done
   * @memberof VinylS3
   */
  _write(file, _, done) {
    const options = this.options;
    const s3 = new AWS.S3({ region: options.region });

    const params = {
      Bucket: options.bucket,
      Key: options.key || file.basename,
      Body: file.contents,
      ACL: "public-read",
    };

    console.log("VinylS3.dest:options:", s3, params);

    // Stream the provided file to the S3 bucket and key
    s3.upload(params)
      .promise()
      .then(() => {
        done();
      })
      .catch((reason) => {
        console.error("VinylS3.dest:s3.upload:", reason);
        done(reason);
      });
  }
}

module.exports = VinylS3;
