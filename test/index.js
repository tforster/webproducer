const WP = require("../src");

// const vs3 = require("../src/Vinyl-s3");
// const vfs = require("vinyl-fs");

// const v = new vs3();
// //vfs.src("**.*").pipe(vfs.dest("./xyz"));
// vfs.src("**.*").pipe(v);

/**
 * Custom transform function to get query results into an object of keys
 */
const transformFunction = (data) => {
  const retVal = {};
  for (const obj in data) {
    if (Array.isArray(data[obj])) {
      data[obj].forEach((o) => {
        retVal[o.key] = o;
      });
    } else {
      retVal[data[obj].key] = data[obj];
    }
  }
  return retVal;
};

const options = {
  transformFunction,
  stage: "stage",
  logLevel: "ALL",
  datoCMSToken: process.env["DATOCMS_TOKEN"],
  amplifyBucket: "wp.yourmentalwealthadvisors.com",
  appId: process.env["AMPLIFY_APP_ID"],
  aws: {
    bucket: "wp.yourmentalwealthadvisors.com",
    key: "archive.zip",
    region: "us-east-1",
    accessKey: process.env["AWS_ACCESS_KEY_ID"],
    secretKey: process.env["AWS_SECRET_ACCESS_KEY"],
  },
};

// Create an instance of the WebProducer class
const wp = new WP(options);
// Call the public buildF() method
//await build.buildF();
wp.main();
