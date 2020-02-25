const { promises: fs } = require("fs");

class Utils {
  /**
   * Empties the specified directories by recursively removing everything and then force recreating
   * @static
   * @param {string[]} directories: Array of relative paths
   * @returns A Promise
   * @memberof Utils
   */
  static async emptyDirectories(directories) {
    if (!Array.isArray(directories)) {
      directories = [directories];
    }
    return Promise.all(directories.map((directory) => fs.rmdir(directory, { recursive: true })));
  }
}

module.exports = Utils;
