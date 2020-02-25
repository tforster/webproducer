("use strict");

// System dependencies (Built in modules)
const { Writable } = require("stream");

// Third party dependencies (Typically found in public NPM packages)
const AWS = require("aws-sdk");

/**
 * Implements Gulp-like dest() function to terminate a piped process by uploading the supplied Vinyl file to AWS S3
 * @class VinylS3
 */
class VinylS3 extends Writable {
  // Ensure instance supports objectMode as we are receiving vinyl files, not raw file chunks
  constructor(options) {
    super({ objectMode: true });
    this.options = options;
  }

  // Mandatory method to implement as per NodeJS stream documentation
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
