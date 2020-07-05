# WebProducer

[![Board Status](https://dev.azure.com/techsmarts/08c518d9-553e-44a6-bd93-33b1b4b46b5c/94878bf3-1784-4a48-9a4a-e692d65425ba/_apis/work/boardbadge/e05cc4cb-70d4-4fcf-be68-9c1a6cb5cf69?columnOptions=1)](https://dev.azure.com/techsmarts/08c518d9-553e-44a6-bd93-33b1b4b46b5c/_boards/board/t/94878bf3-1784-4a48-9a4a-e692d65425ba/Microsoft.RequirementCategory/)

WebProducer, or simply WP, is a serverless application for publishing content to the web. It equally supports websites and web applications with a lean, streams based, architecture.

The current version is dependent upon the Amazon AWS stack, including Amplify, IAM, Lambda and S3. Support for other providers including Google and Microsoft is planned for the future.

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

1. Install using your preferred package manager. E.g. `npm i -S git+ssh://git@github.com/tforster/webproducer.git`
1. Create webproducer.yml. The following example shows multiple formats for templateSource and destination. In practice only one can be used at a time.

   ```yml
   dataSource:
     ## GraphQL query
     type: graphql
     path: https://graphql.datocms.com/
     token: ${env:GRAPHQL_API_TOKEN}

   templateSource:
     ## AWS S3
     type: s3
     path: s3://wp.somebucket.com/src/${env:STAGE}
     region: us-east-1

     ## Local filesystem
     type: filesystem
     path: ./src

   destination:
     ## Local filesystem
     type: filesystem
     path: ./dist
     archive: false

     ## AWS S3
     type: s3
     path: s3://www.somebucket.com
     region: us-east-1
     archive: false # default
     setHttpExtension: false # default
     acl: public-read # default
     deleteOnSync: true # default
     webserver: # optional
       setContentTypeHeader: true # default
       cloudFrontDistributionId: EZP3VGJ7GV1RO # optional

    # preview is currently tightly bound to the DatoCMS implementation for specifying draft vs published
    preview: ${env:PREVIEW}
   ```

1. Create .env

   ```bash
   GRAPHQL_API_TOKEN=******************************
   LOG_LEVEL=ALL
   STAGE=STAGE
   ```

## Change Log

See CHANGELOG.md

## Meta

Troy Forster – @tforster – troy.forster@gmail.com

See LICENSE for more information.

https://github.com/tforster/webproducer

## Contributing

See CONTRIBUTING.md
