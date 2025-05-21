# Use Remote REST API to Create XML files on S3

See how to fetch data from a remote REST API, combine with local templates to produce XML files and stream to AWS S3.

This example illustrates how to:

1. **Stream data from an asynchronous HTTP request**: While this would typically be a GraphQL or REST API query this example fetches a static JSON data file a GitHub Gist since we don't have an anonymous public API endpoint available.
1. **Generate XML files with WebProducer**: Two different XML file formats are generated using Handlebars
1. **Pipe WebProducer output to a source other than the local filesystem**: In this case we stream directly to an AWS S3 bucket using the [vinyl-s3 NPM package](https://www.npmjs.com/package/vinyl-s3). _Note Vinyl S3 has been recently removed from this project due to high severity vulnerabilities_
