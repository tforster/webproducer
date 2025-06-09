// Third party dependencies
import GilbertFile from "../../gilbert-file";

class Utils {
  /**
   * @description: Lightweight wrapper around the GilbertFile constructor for simplicity and consistency.
   * @static
   * @param {object} options: Typical Vinyl params such as path and contents
   * @return {object}             A new GilbertFile object
   * @memberof Utils
   */
  static vinyl(options) {
    // Force cwd to (virtual) root as it makes it MUCH easier to work with and debug
    options.cwd = options.cwd || "/";
    return new GilbertFile(options);
  }

  /**
   * @description: Promisifies an array of streams to allow the caller to await all of them to finish
   * @date 2022-02-05
   * @static
   * @param {array} streams:  Array of streams
   * @return {Promise}:       A Promise of successful completion
   * @memberof Utils
   */
  static streamsFinish(streams) {
    try {
      return Promise.all(
        streams.map(
          (stream) =>
            new Promise((resolve) => {
              stream.on("finish", () => {
                resolve(stream);
              });
              // stream.on("close", () => {
              //   resolve(stream);
              // });
            })
        )
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("error", err);
    }
  }

  static log(msg) {
    // eslint-disable-next-line no-constant-condition
    if (true) {
      // eslint-disable-next-line no-console
      console.log(msg);
    }
  }

  static streamLog(stream) {
    // stream.on("end", () => {
    //   console.log(`${stream.id} end`);
    // });
    // stream.on("data", () => {
    //   //console.log(`${stream.id} data`);
    // });
    // stream.on("finish", () => {
    //   console.log(`${stream.id} finish`);
    // });
    // stream.on("close", () => {
    //   console.log(`${stream.id} close`);
    // });
  }
}

export const log = Utils.log;
export const streamsFinish = Utils.streamsFinish;
export const streamLog = Utils.streamLog;
export const vinyl = Utils.vinyl;
