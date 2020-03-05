const WP = require("../src");

const options = {
  preview: false,
  logLevel: process.env["LOG_LEVEL"],
  datoCMSToken: process.env["DATOCMS_TOKEN"],

  amplifyBucket: "wp.yourmentalwealthadvisors.com",
  appId: process.env["AMPLIFY_APP_ID"],

  // templateSource: {
  //   Bucket: "www.yourmentalwealthadvisors.com",
  //   region: "us-east-1",
  // },
  // destination: {
  //   Bucket: "wp.yourmentalwealthadvisors.com",
  //   region: "us-east-1",
  // },
  templateSource: "/home/tforster/dev/mdb/your-mental-wealth/brand/website/www.yourmentalwealthadvisors.com/src",
  logLevel: "ALL",
  destination: "./dist",
  amplify: {
    Bucket: "wp.yourmentalwealthadvisors.com",
    key: "archive.zip",
    region: "us-east-1",
  },
  transformFunction: (data) => {
    const transformed = {};
    const common = [];
    for (const property in data) {
      if (Array.isArray(data[property])) {
        data[property].forEach((item) => {
          transformed[item.key] = item;
        });
      } else {
        const key = data[property].key;
        if (key) {
          transformed[key] = data[property];
        } else {
          // Objects without keys are considered common/global data
          const obj = {};
          obj[property] = data[property];
          common.push(obj);
        }
      }
    }
    // Add common/global data to each page
    for (const property in transformed) {
      common.forEach((obj) => {
        for (const key in obj) {
          transformed[property][key] = obj[key];
        }
      });
    }
    return transformed;
  },
};

// Create an instance of the WebProducer class
const wp = new WP(options);
// Call the public buildF() method
//await build.buildF();
wp.main();
