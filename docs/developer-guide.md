# Developer Guide <!-- omit in toc -->

_A constantly evolving guide to developing WebProducer. It captures the current state of the architecture, includes rationales and guiding principals._

## Table of Contents <!-- omit in toc -->

- [About](#about)
  - [Approach](#approach)
  - [The Mind's DOM](#the-minds-dom)
- [Architectural Highlights](#architectural-highlights)
- [Developing with WebProducer](#developing-with-webproducer)
- [Developing for WebProducer](#developing-for-webproducer)
  - [Prerequisites](#prerequisites)
  - [Setup and Configuration](#setup-and-configuration)
- [Usage](#usage)

## About

This Developer Guide goes beyond a typical project README to include not just the "how" but also the "why". I believe that by providing context behind architectural decisions the spirit of WebProducer can be successfully maintained and evolved.

### Approach

As usual the approach follows the "lean is better" idea:

- **Lean tooling**: By keeping tooling to a minimum we can move with increased agility and there is less likelihood that a project can be stalled by a stuck dependency in the tool chain. It also allows us to adapt and adopt cutting edge principals without waiting for tool developers to catch up.
- **Lean coding**:
- **Lean dependencies**: Even with JavaScript tree shaking capabilities there is little advantage to using general purpose libraries and frameworks any more. Evergreen browsers and very capable standards have all but eliminated this need which often requires specific framework learning curves. By investing the same time and effort into a deeper understanding of the actual challenge the library was going to abstract we become better developers and stronger debuggers when things break.

Pros:

- Less time spent f**king around with giant convoluted toolsets and massive libraries created to [battle poor social network architecture](https://blog.risingstack.com/the-history-of-react-js-on-a-timeline/#:~:text=Back%20in%202011,of%20React.js.)
- Quicker time to market
- Faster page loads
- Lower page weights
- Exceptionally low running costs
- Easier debugging
- Greater enjoyment of the process
- More time to focus on the fun aspect of creative problem solving

### The Mind's DOM

Being a great developer means being able to maintain complex mental models of the problem at hand. This is why most developers hate being interrupted because it takes a while to rebuild those mental models.

![[THIS IS WHY YOU SHOULDN'T INTERRUPT A PROGRAMMER](https://heeris.id.au/2013/this-is-why-you-shouldnt-interrupt-a-programmer/)](https://heeris.id.au/trinkets/ProgrammerInterrupted.png)

When working on web projects I liken this to the "mind's DOM". As developers we create a DOM in our mind that renders the HTML, CSS and JS that we are working on. And like a browser DOM:

- Our mind's DOM struggles when those resources become unduly complex
- Out mind's DOM performs best with separation of concerns when it can process HTML, CSS and JS separately. E.g. using the JavaScript engine to render HTML is not as efficient as using the HTML engine to render HTML.

Thus we use Handlebars templates for (almost) strictly token replacement only. While Handlebars "can" support logic within the template I strongly discourage the practice. The only logic recommended in the template is simple `if/then` and `repeaters`. The resulting template files look very close to the final output and it should be trivial to read even a lengthy Handlebars HTML template and render it in your mind's DOM.

## Architectural Highlights

While the architecture of WebProducer is surprisingly simple given it's power and capability it is useful to highlight several key areas including:

- **Streams Based**: Using streams drastically improves performance and efficiency. Since streams "pass through" the various pipes the overall memory requirements are small as space does not have to be set aside to contain the entire data set. Streams also allow data to be processed from the first byte rather than waiting for all bytes to be received.
- **Files Represented as Vinyl Objects**: [Vinyl](https://github.com/gulpjs/vinyl) is a metadata schema created by [Gulp](https://gulpjs.com/) to describe files in streams and is the underpinning of the massively successful Gulp ecosystems. While WebProducer has absolutely no dependency or requirement for Gulp it does use the same schema for describing files. This makes many of the thousands of Gulp plugins compatible with WebProducer.
- **Separation of Concerns**: WebProducer produces HTML, CSS and JavaScript content that targets web browsers and today's web browsers have been well engineered to extract peak performance from HTML, CSS and JavaScript.
- **Low Logic Templating**:
Components with Handlebars
- **ESBuild**:
Challenge with ESBuild

## Developing with WebProducer

This section applies to developers wishing to incorporate WebProducer into their production workflow and addresses scenarios for building and publishing web content.

## Developing for WebProducer

Please read this section if you are interested in advancing and contributing to WebProducer.

### Prerequisites

The versions listed for these prerequisites are current at the time of writing. More recent versions will likely work but "your mileage may vary".

- **A good code editor**: Since we use [Microsoft VSCode](https://code.visualstudio.com/download) debugging support in the form of a launch.json file is available in the accompanying .vscode directory.
- **NodeJS 17.5.0 and NPM 8.4.1**: While WebProducer has been developed and tested using the latest current version of Node care is taken to ensure it works with v14 LTS to ensure runtime compatibility with [AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html). Unfortunately this means that no >14 Node capabilities can be incorporated into WebProducer until AWS updates its runtime. [NVM](https://github.com/nvm-sh/nvm) is recommended to install and manage Node versions.
- Git 2.34.1

### Setup and Configuration

Clone this repository as your new project `git clone git@github.com:tforster/webproducer.git ~/dev/`

## Usage
