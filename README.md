# WebProducer

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

WebProducer can be installed as a runtime dependency using your favourite package manager.

```bash
# NPM
npm i -S @tforster/webproducer

# Yarn
yarn ?
```

Once installed simply initialise an instance via the constructor, passing in some options then call the build() method.

```javascript
const WP = require("webproducer);

const options = {
  transformFunction: function(data) { ... },
  stage: "dev",
  local: true, // true to run in a local development environment or false to run in AWS Lambda environment
  datoCMSToken: process.env["DATOCMS_TOKEN"],
  amplifyBucket: "{some-s3-bucket-name}",
  appId: process.env["AMPLIFY_APP_ID"],
  aws: {
    bucket: "{some-s3-bucket-name}",
    key: "archive.zip",
    region: "ca-central-1",
    accessKey: process.env["AWS_ACCESS_KEY_ID"],
    secretKey: process.env["AWS_SECRET_ACCESS_KEY"],
  },
};

const build = new WP(options);
build.buildF()
.then(result => {
  // Act on the result
})
.catch(reason => {
  // Act on the exception
});

```

### Tools Directory

Copy the contents of the tools directory to the root of your web project. After making theme-dev.sh executable with `chmod +x theme-dev.sh` run the shell script to:

- Start the Serverless Offline plugin, listening on port 3000, to simulate a local API Gateway and Lambda processor
- Start a local HTTP server on port 3701 to view your web project
- Start a watcher on the theme and resources folder to trigger rebuilds when a file changes

## For Module Developers

After cloning this repository be sure to run `npm i` to install the runtime as well as developer dependencies. This module was created with the help of the [Serverless Framework](https://http://serverless.com/) and you should be familiar with how it works. This source code assumes you will use the [serverless offline plugin](https://github.com/dherault/serverless-offline) to emulate AWS λ and API Gateway locally. An NPM script is provided to easily launch the plugin on port 3000. If you are using Visual Studio Code please consider adding the following profile to .vscode/launch.json. It will connect the VSCode debugger to the running offline plugin and allow you to step through the Lambda source.

```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach",
  "cwd": "${fileDirname}",
  "port": 9229,
  "skipFiles": [
    "<node_internals>/**"
  ]
},
```

## Built With

The following is a list of the technologies used to develop and manage this project.

| Tool                                                                                                              | Description                                                                                          |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [AWS-SDK](https://aws.amazon.com/sdk-for-node-js/)                                                                | Helps orchestrate S3 and Cloudfront management                                                       |
| [Coffee](https://en.wikipedia.org/wiki/Coffee)                                                                    | A good source of [C8H10N4O2](https://pubchem.ncbi.nlm.nih.gov/compound/caffeine)                     |
| [DatoCMS](https://www.datocms.com)                                                                                | A GraphQL native CaaS                                                                                |
| [Git 2.17.1](https://git-scm.com/)                                                                                | Source Code Management (SCM) client                                                                  |
| [Joy](https://github.com/tforster/joy)                                                                            | A semi-opinionated framework for managing some common devops tasks                                   |
| [NodeJS 12.3.0](https://nodejs.org/en/)                                                                           | Task running, automation and driving the API                                                         |
| [NPM 6.10.1](https://www.npmjs.com/package/npm)                                                                   | Node package management                                                                              |
| [Oh-My-Zsh](https://github.com/robbyrussell/oh-my-zsh)                                                            | ZSH shell enhancement                                                                                |
| [Serverless Framework](https://serverless.com)                                                                    |                                                                                                      |
| [Ubuntu 18.04 for WSL2](https://www.microsoft.com/en-ca/p/ubuntu/9nblggh4msv6?activetab=pivot:overviewtab)        | Canonical supported Ubuntu for Windows Subsystem for Linux                                           |
| [Visual Studio Code 1.41.1](https://code.visualstudio.com/)                                                       | Powerful and cross-platform code editor                                                              |
| [Windows 10 Pro Insider Preview](https://www.microsoft.com/en-us/software-download/windowsinsiderpreviewadvanced) | The stable version of the Insiders build typically brings new tools of significant use to developers |
| [WSL 2](https://docs.microsoft.com/en-us/windows/wsl/install-win10)                                               | Windows Subsystem for Linux supports native Linux distributions                                      |
| [ZSH](https://www.zsh.org/)                                                                                       | A better shell than Bash                                                                             |

## Change Log

v0.0.1 **Bug fixes in concert with YMWA** (2020-02-19)

Numerous minor issues were resolved after using WebProducer in a first run with Your Mental Wealth Advisors website.

v0.0.0 **Initial creation** (2020-01-07)

Git repository created and proof-of-concept code added to /src directory.
