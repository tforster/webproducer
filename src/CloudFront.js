("use strict");

// Third party dependencies (Typically found in public NPM packages)
const AWS = require("aws-sdk");

/**
 * Currently just provides a simple wrapper around the createInvalidation() endpoint
 *
 * @class CloudFront
 */
class CloudFront {
  /**
   *
   *
   * @static
   * @param {object} options: Data including the CloudFront distribution Id, AWS region and the files to invalidate
   * @returns:                An object of meta data describing the newly created invalidation task
   * @memberof CloudFront
   */
  static createInvalidation(options) {
    const cloudFront = new AWS.CloudFront({ region: options.region });
    const params = {
      DistributionId: options.distributionId,
      InvalidationBatch: {
        // CallerReference must be unique each time
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
