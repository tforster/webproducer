("use strict");

// System dependencies (Built in modules)
const { Readable, Writable } = require("stream");

// Third party dependencies (Typically found in public NPM packages)
const AWS = require("aws-sdk");
const micromatch = require("micromatch");
const Vinyl = require("vinyl");

// Project dependencies
const Utils = require("./Utils");

class CloudFront {
  static createInvalidation(options) {
    const cloudFront = new AWS.CloudFront({ region: options.region });
    const params = {
      DistributionId: options.distributionId,
      InvalidationBatch: {
        CallerReference: `wp${new Date().getTime()}`,
        Paths: {
          Quantity: options.paths.length,
          Items: options.paths,
        },
      },
    };
    return cloudFront.createInvalidation(params).promise();
  }
}
module.exports = CloudFront;
