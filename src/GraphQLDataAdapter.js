("use strict");

// Third party dependencies (Typically found in public NPM packages)
const fetch = require("node-fetch");

/**
 * ToDo: data() and _fetchData() can be better organised now they've been merged into the same module
 *
 * @class GraphQLDataAdapter
 */
class GraphQLDataAdapter {
  /**
   * Fetch wrapper around the provided GraphQL endpoint and GraphQL query
   * @static
   * @param {string} endpoint:            The GraphQL fully qualified HTTP endpoint to execute the query against
   * @param {string} query:               The GraphQL query to execute
   * @param {string} token:               The optional auth token required by the GraphQL provider
   * @param {boolean} [published=false]:  True to fetch published items, false to fetch all items including drafts
   * @returns {json}:                     The JSON representation of the resulting data
   * @memberof GraphQLDataAdapter
   */
  static async data(endpoint, query, token, published = false) {
    if (!token || token === "undefined") {
      throw new Error("GraphQL token not provided");
    }
    if (!query) {
      throw new Error("GraphQL query not provided");
    }

    // Construct the URL for preview vs published. GraphQL endpoint of "/" = published, "/preview" includes drafts
    let url = new URL(endpoint);
    url = GraphQLDataAdapter._providerPublished("datocms", url, published);

    try {
      // Execute the request
      const response = await fetch(url.href, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: query,
        }),
      });

      const result = await response.json();

      if (result.errors) {
        throw result;
      } else return result.data;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Rewrites the URL to account for provider specific syntax when selecting draft vs published items
   * @static
   * @param {string} provider:    The GraphQL provider. Currently supports DatoCMS and CosmicJS. Others will be added as required.
   * @param {string} endpoint:    The GraphQL fully qualified HTTP endpoint to execute the query against
   * @param {boolean} published:  True to fetch published items, false to fetch all items including drafts
   * @returns {string}:           Returns a modified URL with any query parameters required by the provider
   * @memberof GraphQLDataAdapter
   */
  static _providerPublished(provider, endpoint, published) {
    switch (provider) {
      case "datocms":
        if (!published) {
          endpoint.pathname = "preview";
        }
        break;
      case "cosmicjs":
        break;
      default:
        throw new Error("Unrecognised provider for publish status");
    }
    return endpoint;
  }
}

module.exports = GraphQLDataAdapter;
