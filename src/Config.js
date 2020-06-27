const fs = require("fs");
const YAML = require("yaml");


module.exports = (configPathOrString) => {
  // Default the string to be parsed to our function argument  
  let configString = configPathOrString;

  // Check to see if our function argument is a point to a file
  if (fs.existsSync(configPathOrString)) {
    configString = fs.readFileSync(configPathOrString, { encoding: "utf8" });
  }

  // Parse the config string
  try {
    // Replace ${env:xxx} with environment variable
    const pattern = /\$\{\w*:(\w*)\}$/igm;
    configString = configString.replace(pattern, (match, p1, p2) => {
      return process.env[p1];
    });

    return YAML.parse(configString, {});
  }
  catch (err) {
    console.error("parsing failed", err);
    throw err;
  }
}
