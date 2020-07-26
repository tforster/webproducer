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
   * @param {hash} options:     Includes GraphQL endpoint, DatoCMS token, etc
   * @param {boolean} preview:  True to retrieve unpublished (aka draft) content
   * @returns
   * @memberof GraphQLDataSource
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
   *
   * Rewrites the URL to account for provider specific syntax when selecting draft vs published items
   * @static
   * @param {*} provider
   * @param {*} url
   * @param {*} published
   * @returns
   * @memberof GraphQLDataAdapter
   */
  static _providerPublished(provider, url, published) {
    switch (provider) {
      case "datocms":
        if (published) {
          url.pathname = "preview";
        }
        break;
      case "cosmicjs":
        break;
      default:
        throw new Error("Unrecognised provider for publish status");
    }
    return url;
  }
}

module.exports = GraphQLDataAdapter;
