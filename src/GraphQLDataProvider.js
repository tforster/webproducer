("use strict");

// System dependencies (Built in modules)
const fetch = require("node-fetch");
const fs = require("fs").promises;

class GraphQLDataProvider {
  /**
   * Empties the specified directories by recursively removing everything and then force recreating
   * @static
   * @param {string[]} directories: Array of relative paths
   * @returns A Promise
   * @memberof Utils
   */
  static async data(options) {
    return new Promise(async (resolve, reject) => {
      // Fetch the query to execute
      //const query = await fs.readFile("./db/query.graphql", { encoding: "utf8" });
      const query = await fs.readFile(options.query, { encoding: "utf8" });

      try {
        //const response = await fetch("https://graphql.datocms.com/", {
        const response = await fetch(options.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${options.token}`,
          },
          body: JSON.stringify({
            query: query,
          }),
        });
        let data = (await response.json()).data;

        if (options.transform) {
          data = options.transform(data);
        }
        return resolve(data);
      } catch (reason) {
        return reject(reason);
      }
    });
  }
}

module.exports = GraphQLDataProvider;
