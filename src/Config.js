("use strict");

// System dependencies (Built in modules)
const fs = require("fs");

// Third party dependencies (Typically found in public NPM packages)
const YAML = require("yaml");

/**
 * Implements a simple configuration processor that parses YAML into returnable properties.
 * @class Config
 */
class Config {
  /**
   * Parse the provided file or text into properties
   * @static
   * @param {string} configPathOrString:  The path to a YAML file, or actual YAML text
   * @returns {object}:                   The properties found in the YAML with any included environment variables expanded
   * @memberof Config
   * TODO: Parsing a string param (not a file) still needs to be implemented
   */
  static getConfig(configPathOrString) {
    // Default the string to be parsed to our function argument
    let configString = configPathOrString;

    // Check to see if our function argument is a point to a file
    if (fs.existsSync(configPathOrString)) {
      configString = fs.readFileSync(configPathOrString, { encoding: "utf8" });
    }

    // Parse the config string
    try {
      // Replace ${env:xxx} with environment variable
      const pattern = /\$\{\w*:(\w*)\}$/gim;
      configString = configString.replace(pattern, (match, p1, p2) => process.env[p1]);

      return YAML.parse(configString, {});
    } catch (err) {
      throw new Error("YAML parsing failed", err);
    }
  }
}

module.exports = Config;
