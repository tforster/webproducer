("use strict");

// System dependencies (Built in modules)
const { Writable } = require("stream");

// Third party dependencies (Typically found in public NPM packages)
const AWS = require("aws-sdk");
const fetch = require("node-fetch");

/**
 * A wrapper around the minimum required AWS Amplify methods required to deploy the built web artifacts
 * @class Amplify
 */
class AmplifyFileAdapter {
  /**
   * Possible new dest() method for consuming readable streams and a replacement for .deploy(). Depends whether we can determine
   * what the AWS API is for POSTing zipUploadUrl obtained from Amplify.createDeployment(). No known documentation exists at this
   * time and a message has been posted in an AWS forum.
   *
   * @static
   * @param {object} props: Constructor properties
   * @returns               A Writable stream
   * @memberof VinylAmplify
   */
  static dest(props) {
    const writable = new Writable({ objectMode: true });

    writable._write = async function (file, _, done) {
      if (file.basename !== "archive.zip") {
        // We only expect a single file called archive.zip
        throw new Error("File archive.zip not found.");
      }

      // Create an instance of the AWS Amplify class
      const amplify = new AWS.Amplify({ region: props.amplifyDeploy.region });

      // Get an Amplify job Id and upload Url
      const result = await amplify
        .createDeployment({
          appId: props.appId,
          branchName: props.stage,
        })
        .promise();

      // Attempt to stream the zip file to Amplify
      try {
        var result2 = await fetch(result.zipUploadUrl, {
          method: "POST",
          body: file.contents,
          headers: {
            "Content-Type": "application/zip",
          },
        });
      } catch (err) {
        console.error(err);
        done(err);
      }
      console.log(result2);
      done();
    };

    // Simple Writable error handler
    writable.on("error", (err) => {
      console.error("Vinyl-Amplify.error:", err);
      throw err;
    });

    return writable;
  }

  /**
   *
   * Deploy a pre-existing AWS Amplify website using content from an S3 bucket
   * @static
   * @param {object} options: A small set of properties describing S3 object details, AWS regions and Amplify application identity
   * @returns {promise}
   * @memberof Amplify
   */
  static async deploy(options) {
    // Construct the source Url to fetch the archive from
    const sourceUrl = `https://s3.amazonaws.com/${options.aws.Bucket}/${options.aws.key}`;

    // Create new Amplify client
    const amplify = new AWS.Amplify({ region: options.aws.amplifyRegion });

    // Set the minimal required Amplify application identifiers. Assumes the application was pre-created in the AWS Amplify Console
    const appId = options.appId;
    const branchName = options.stage;

    // Deploy a previously copied zip from S3
    // ! Amplify deploys only changed files from the zip and does garbage collection on redundant files "later"
    const result = await amplify
      .startDeployment({
        appId,
        branchName,
        sourceUrl,
      })
      .promise();

    console.log("Amplify startDeployment:", result);
    return Promise.resolve();
  }
}

module.exports = AmplifyFileAdapter;
