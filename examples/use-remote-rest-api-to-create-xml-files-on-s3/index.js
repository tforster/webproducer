"use strict";

// TODO: Wrap in an AWS Lambda function that exposes a single REST POST endpoint to act as the triggering webhook

// Cache the start time as early as possible for best accuracy in elapsed time reporting.
const start = new Date();

// Third party dependencies
import fetch from "node-fetch"; // The native fetch API is available in Node 17.5+ but AWS Lambda runtime only supports v14 LTS.
import s3 from "vinyl-s3";
import vfs from "vinyl-fs";
import WebProducer from "../../src/index.js";

const destination = {
  bucket: "s3://webproducer-test.tforster.com",
  distributionId: "abc",
};

// Setup the incoming GraphQL data stream. In this case we fake the response from a GraphQL server by calling a GitHub Gist mock.
const response = await fetch(
  // eslint-disable-next-line max-len
  "https://gist.githubusercontent.com/tforster/61d4a11fe10d9ddb5fd1264feedd83a3/raw/3c7f80fb8e06900b72a41c4592a47c8ce9bb084c/graphql.json"
);

// WebProducer parameters. Processing XML files only so unneeded scripts, stylesheets and static files pipelines are set to false.
const params = {
  pages: {
    data: { stream: response.body },
    theme: { stream: vfs.src(["./src/templates/**/*.hbs"]) },
  },
  scripts: false,
  stylesheets: false,
  files: false,
};

// Create a new instance of WebProducer
const webproducer = new WebProducer();

// Initialise the destination
const dest = s3.dest(destination.bucket);

// Create an error handler to capture any S3 issues
dest.on("error", (err) => {
  console.error("S3 related error:", err);
});

// Add an event handler to write some useful information to the console when everything is complete
dest.on("finish", () => {
  console.log(
    `Processed ${webproducer.resources} XML files totalling ${(webproducer.size / (1024 * 1024)).toFixed(2)} Mb to ${
      destination.bucket
    } in ${new Date() - start} ms.`
    // TODO: Invalidate CloudFront
  );
});

// Configure WebProducer with the params (can't pass in the constructor because they are asynchronous)
webproducer.produce(params);

// Pipe the produced files to the destination S3 bucket
webproducer.mergeStream.pipe(dest);
