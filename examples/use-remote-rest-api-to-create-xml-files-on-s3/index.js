"use strict";

// Cache the start time as early as possible for best accuracy in elapsed time reporting.
const start = new Date();

// Third party dependencies
import fetch from "node-fetch"; // The native fetch API is available in Node 17.5+ but AWS Lambda runtime only supports v14 LTS.
import s3 from "vinyl-s3";
import vfs from "vinyl-fs";
import WebProducer from "../../src/index.js";

// Define an S3 bucket to send the XML files to
const bucket = "s3://webproducer-test.tforster.com";

// We use a GitHub Gist to mock a REST API GET request
const response = await fetch(
  // eslint-disable-next-line max-len
  "https://gist.githubusercontent.com/tforster/61d4a11fe10d9ddb5fd1264feedd83a3/raw/3c7f80fb8e06900b72a41c4592a47c8ce9bb084c/graphql.json"
);

// Minimum required WebProducer parameters for this example is just the uris object
const params = {
  uris: {
    data: { stream: response.body },
    theme: { stream: vfs.src(["./src/templates/**/*.hbs"]) },
  },
};

// Create a new instance of WebProducer
const webproducer = new WebProducer();

// Initialise the destination
const dest = s3.dest(bucket);

// Add an event handler to write some useful information to the console when everything is complete
dest.on("finish", () => {
  console.log(
    `Processed ${webproducer.resources} XML files totalling ${(webproducer.size / (1024 * 1024)).toFixed(2)} Mb to ${bucket} in ${
      new Date() - start
    } ms.`
  );
});

// Configure WebProducer with the params (can't pass in the constructor because they are asynchronous)
webproducer.produce(params);

// Pipe the produced files to the destination S3 bucket
webproducer.mergeStream.pipe(dest);
