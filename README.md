# WebProducer

[![Board Status](https://dev.azure.com/techsmarts/08c518d9-553e-44a6-bd93-33b1b4b46b5c/94878bf3-1784-4a48-9a4a-e692d65425ba/_apis/work/boardbadge/e05cc4cb-70d4-4fcf-be68-9c1a6cb5cf69?columnOptions=1)](https://dev.azure.com/techsmarts/08c518d9-553e-44a6-bd93-33b1b4b46b5c/_boards/board/t/94878bf3-1784-4a48-9a4a-e692d65425ba/Microsoft.RequirementCategory/)

WebProducer, or simply WP, is a serverless application for publishing content to the web. It equally supports websites and web applications with a lean, streams based, architecture.

The current version is dependent upon the Amazon AWS stack, including IAM, Lambda, S3+CloudFront. Support for other providers including Google and Microsoft is planned for the future.

The core of the module is a NodeJS Lambda function. This function is intended to act as the endpoint for a webhook from your preferred CMS. Changing content in the CMS should trigger the webhook which will then

1. Fetch the full content from the CMS
2. Fetch the list of existing files and their ETags
3. Load and register the theme
4. Merge the content with the theme to produce raw output
5. Process the raw output to minify all HTML, CSS and JavaScript files
6. Create a sitemap.xml file
7. Create any optional RSS files if syndicated content is detected
8. Compare built files to list fetched in step 2 and build a difference
9. Stream the difference to the target
10. If the target is an S3 bucket and a CloudFront id has been specified then CloudFront will be invalidated

## Prerequisites

The versions listed for these prerequisites are current at the time of writing. More recent versions will likely work but "your mileage may vary".

- A good code editor.
- Node.js v12.13.0&dagger; and NPM 6.14.5
- Git 2.25

&dagger; WebProducer is often used in AWS Lambda FaaS. The current hightest Node runtime version supported by AWS is v12.

## Setup and Configuration

Clone this repository as your new project `git clone git@github.com:tforster/webproducer.git ~/dev/`

## Usage

1. Install using your preferred package manager. E.g. `npm i -S git+ssh://git@github.com/tforster/webproducer.git#semver:v0.7.1`
1. Create webproducer.yml. The following example shows multiple formats for data, templates and destination by way of aliases introduced in 0.6.0.

   ```yml
   data: ${env:DATA_ALIAS} # Uses an environment variable to specify an alias
   templates: template-fs # Points to an alias
   destination: # References the destination object directly
     type: filesystem
     base: ./dist
     archive: false # default

   ####################
   # Template Aliases #
   ####################

   template-fs:
     type: filesystem
     base: ./src

   template-s3:
     type: s3
     base: s3://wp.somedomain.com/${env:STAGE}
     region: ca-central-1

   #######################
   # Destination Aliases #
   #######################

   destination-fs:
     type: filesystem
     base: ./dist
     archive: false # default

   destination-s3:
     type: s3
     base: s3://www.somedomain.com
     region: ca-central-1
     archive: false # default

   ################
   # Data Aliases #
   ################

   data-gql:
     type: graphql
     base: https://graphql.datocms.com/
     token: ${env:GRAPHQL_API_TOKEN}
     published: ${env:PUBLISHED}

   data-get-request: # REST not implemented. Future consideration only.
     type: get
     base: https://some-endpoint.com/this/that

   data-sql: # SQL not implemented. Future consideration only.
     type: sql
     base: Server=myServerName\myInstanceName;Database=myDataBase;User Id=${env:DB_USERNAME};Password=${env:DB_PASSWORD};

   data-mongodb: # Mongo not implemented. Future consideration only.
     type: mongo
     base: mongodb://mongodb0.example.com:27017
   ```

1. Create .env file using the following schema. Note that most of the parameters are not secrets and could easily be stored in webproducer.yml, however, we have found that externalising to the .env file makes it easier to toggle between template and destination locations during development of a consuming app.

   ```bash
   ALIAS_DATA=data-gql               # Alias the data source
   ALIAS_TEMPLATES=template-s3       # Alias the template source
   ALIAS_DESTINATION=destination-s3  # Alias the destination source
   GRAPHQL_API_TOKEN=***             # Only needed if you are using GraphQL and on a private endpoint
   STAGE=stage                       # One of dev, stage or prod
   PUBLISHED=true                    # Typically only required for GraphQL to distinguish between draft and published content
   CLOUDFRONT_ID=                    # The production CloudFront distribution to invalidate on deploy. Leave blank for dev and stage
   ```

## Change Log

See CHANGELOG.md

## Meta

Troy Forster – @tforster – troy.forster@gmail.com

See LICENSE for more information.

https://github.com/tforster/webproducer

## Contributing

See CONTRIBUTING.md
