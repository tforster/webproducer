("use strict");

// System dependencies (Built in modules)
const { Writable } = require("stream");

// Third party dependencies (Typically found in public NPM packages)
const AWS = require("aws-sdk");

/**
 * Implements Gulp-like dest() function to terminate a piped process by uploading the supplied Vinyl file to AWS S3
 * @class VinylS3
 */
class VinylS3 {
  static dest(_, options) {
    const writable = new Writable({
      objectMode: true,
      write(file, _, done) {
        // Setup AWS S3 API
        const s3 = new AWS.S3({ region: options.aws.region });
        const params = {
          Bucket: options.aws.bucket,
          Key: options.aws.key || file.basename,
          Body: file.contents,
          ACL: "public-read",
        };
        console.log("VinylS3.dest:options:", s3, params);
        // Stream the provided file to the S3 bucket and key
        s3.upload(params)
          .promise()
          .then((result) => {
            done();
          })
          .catch((reason) => {
            console.error("VinylS3.dest:s3.upload:", reason);
            done(reason);
          });
      },
    });

    writable.on("error", (reason) => {
      console.error("VinylS3.dest:writable.on.error", reason);
      throw reason;
    });

    return writable;
  }
}

module.exports = VinylS3;
