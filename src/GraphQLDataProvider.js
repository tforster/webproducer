("use strict");

// System dependencies (Built in modules)
const fetch = require("node-fetch");
const fs = require("fs").promises;

class GraphQLDataProvider {
  /**
   * Fetch wrapper around the provided GraphQL endpoint and GraphQL query
   * @static
   * @param {*} options
   * @returns
   * @memberof GraphQLDataProvider
   */
  static async data(options, preview) {
    console.log("GraphQLDataProvider.data.options", options);

    try {
      // Fetch the query to execute
      const query = await fs.readFile(options.query, { encoding: "utf8" });

      // Construct the URL for preview vs published. GraphQL endpoint of "/" = published, "/preview" includes drafts
      const url = new URL(options.endpoint);
      if (preview) {
        url.pathname = "preview";
      }

      // Execute the request
      const response = await fetch(url.href, {
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

      const result = await response.json();

      if (result.errors) {
        console.log("GraphQLDataProvider.data errors");
        throw result;
      } else if (result.data) {
        let data = result.data;
        if (options.transform) {
          data = options.transform(data);
        }
        console.log("GraphQLDataProvider.data success");
        return data;
      }
    } catch (err) {
      console.error("GraphQLDataProvider.data error", err);
      throw err;
    }
  }
}

module.exports = GraphQLDataProvider;
