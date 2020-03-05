("use strict");

// Third party dependencies (Typically found in public NPM packages)
const AWS = require("aws-sdk");

/**
 * A wrapper around the minimum required AWS Amplify methods required to deploy the built web artifacts
 * @class Amplify
 */
class Amplify {
  /**
   *
   * Deploy a pre-existing AWS Amplify website using content from an S3 bucket
   * @static
   * @param {object} options: A small set of properties describing S3 object details, AWS regions and Amplify application identity
   * @returns {promise}
   * @memberof Amplify
   */
  static async deploy(options) {
    console.log("Amplify.deploy.options:", options);
    // Construct the source Url to fetch the archive from
    const sourceUrl = `https://s3.${options.aws.bucketRegion}.amazonaws.com/${options.aws.Bucket}/${options.aws.key}`;
    console.log("Amplify.deploy.sourceUrl:", sourceUrl);

    // Create new Amplify client
    const amplify = new AWS.Amplify({ region: options.aws.amplifyRegion });

    // Set the minimal required Amplify application identifiers. Assumes the application was pre-created in the AWS Amplify Console
    const appId = options.appId;
    const branchName = options.stage;

    console.log("Amplify.deploy", options, sourceUrl);

    // Deploy a previously copied zip from S3
    // ! Amplify deploys only changed files from the zip and does garbage collection on redundant files "later"
    const result = await amplify
      .startDeployment({
        appId,
        branchName,
        sourceUrl,
      })
      .promise();

    console.log("Amplify.deploy result:", result);
    return Promise.resolve("zip uploaded to AWS Amplify");
  }
}

module.exports = Amplify;
