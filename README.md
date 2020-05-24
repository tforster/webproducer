# WebProducer

[![Board Status](https://dev.azure.com/techsmarts/08c518d9-553e-44a6-bd93-33b1b4b46b5c/94878bf3-1784-4a48-9a4a-e692d65425ba/_apis/work/boardbadge/e05cc4cb-70d4-4fcf-be68-9c1a6cb5cf69?columnOptions=1)](https://dev.azure.com/techsmarts/08c518d9-553e-44a6-bd93-33b1b4b46b5c/_boards/board/t/94878bf3-1784-4a48-9a4a-e692d65425ba/Microsoft.RequirementCategory/)

WebProducer, or simply WP, is a serverless application for publishing content to the web. It equally supports websites and web applications with a lean, streams based, architecture.

The current version is dependent upon the Amazon AWS stack, including Amplify, IAM, Lambda and S3. Support for other providers including Google and Microsoft is planned for the future.

The core of the module is a NodeJS Lambda function. This function is intended to act as the endpoint for a webhook from your preferred CMS. Changing content in the CMS should trigger the webhook which will then

1. Fetch the full content from the CMS
2. Load and register the theme
3. Merge the content with the theme to produce raw output
4. Process the raw output to minify all HTML, CSS and JavaScript files
5. Create a sitemap.xml file
6. Create any optional RSS files if syndicated content is detected
7. Zip the content into a single distributable
8. Upload the distributable to an S3 bucket
9. Tell Amplify to deploy the distributable from the bucket

## Installation

WebProducer can be installed as a runtime dependency by adding to your package.json

```bash
  ...
  "dependencies": {
    "@tforster/webproducer": "git+ssh://git@github.com/tforster/webproducer.git",
    ...
  },
  ...
```

## Usage

1. Install required dependencies with `npm i`
1. Create config.js and .env files

```javascript
// config.js

require('dotenv').config();

module.exports = {
  preview: true,
  graphQL: {
    apiToken: process.env['GRAPHQL_API_TOKEN'],
    apiEndpoint: process.env['GRAPHQL_API_ENDPOINT'],
  },
  logLevel: 'ALL',
  archiveDestination: false,
  appId: process.env['AMPLIFY_APP_ID'],
  stage: 'stage',

  templateSource: './src',
  destination: './dist',
};
```

```bash
# .env

GRAPHQL_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx     # Authentication token provided by your GraphQL provider
GRAPHQL_API_ENDPOINT={https GraphQL endpoint}       # GraphQL endpoint
AMPLIFY_APP_ID=xxxxxxxxxxxxxx                       # AWS Amplify application id if deploying to AWS Amplify
LOG_LEVEL=ALL                                       # Logging verbosity
DEPLOY_BUCKET={bucket-name}                         # AWS bucket to store built artifacts if deploying to AWS Amplify
DEPLOY_PROFILE={aws-profile-name}                   # AWS profile name from ~/.aws/credentials
```

## Built With

The following is a list of the technologies used to develop and manage this project.

| Tool                                                                                                              | Description                                                                                          |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [AWS-SDK](https://aws.amazon.com/sdk-for-node-js/)                                                                | Helps orchestrate S3 and Cloudfront management                                                       |
| [Coffee](https://en.wikipedia.org/wiki/Coffee)                                                                    | A good source of [C8H10N4O2](https://pubchem.ncbi.nlm.nih.gov/compound/caffeine)                     |
| [DatoCMS](https://www.datocms.com)                                                                                | A GraphQL native CaaS                                                                                |
| [Git 2.25.1](https://git-scm.com/)                                                                                | Source Code Management (SCM) client                                                                  |
| [Joy](https://github.com/tforster/joy)                                                                            | A semi-opinionated framework for managing some common devops tasks                                   |
| [NodeJS 12.3.0](https://nodejs.org/en/)                                                                           | Task running, automation and driving the API                                                         |
| [NPM 6.14.5](https://www.npmjs.com/package/npm)                                                                   | Node package management                                                                              |
| [Oh-My-Zsh](https://github.com/robbyrussell/oh-my-zsh)                                                            | ZSH shell enhancement                                                                                |
| [Serverless Framework](https://serverless.com)                                                                    |                                                                                                      |
| [Ubuntu 20.04 for WSL2](https://www.microsoft.com/en-ca/p/ubuntu/9nblggh4msv6?activetab=pivot:overviewtab)        | Canonical supported Ubuntu for Windows Subsystem for Linux                                           |
| [Visual Studio Code 1.45.1](https://code.visualstudio.com/)                                                       | Powerful and cross-platform code editor                                                              |
| [Windows 10 Pro Insider Preview](https://www.microsoft.com/en-us/software-download/windowsinsiderpreviewadvanced) | The stable version of the Insiders build typically brings new tools of significant use to developers |
| [WSL 2](https://docs.microsoft.com/en-us/windows/wsl/install-win10)                                               | Windows Subsystem for Linux supports native Linux distributions                                      |
| [ZSH](https://www.zsh.org/)                                                                                       | A better shell than Bash                                                                             |

## Change Log

v0.4.0 **Switched repository** (2020-05-24)

Migrated the repository from Azure DevOps repos to GitHub.

v0.3.0 **Improve stream stability** (2020-03-26)

Streams support was refactored to improve both stability and performance.

v0.2.0 **First-use updates** (2020-02-19)

Numerous minor issues were resolved after using WebProducer for the first time as a dependency of a real project.

v0.1.0 **Initial creation** (2020-01-07)

Git repository created and proof-of-concept code added to /src directory.
