// Third party dependencies
import Vinyl from "vinyl";

class Utils {
  /**
   * @description: Lightweight wrapper around the Vinyl constructor for simplicity and consistency.
   * @date 2022-02-06
   * @static
   * @param {object} vinylParams: Typical Vinyl params such as path and contents
   * @return {object}             A new Vinyl object
   * @memberof Utils
   */
  static vinyl(vinylParams) {
    // Force cwd to (virtual) root as it makes it MUCH easier to work with and debug
    vinylParams.cwd = vinylParams.cwd || "/";
    return new Vinyl(vinylParams);
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
                console.log("streams finish", stream.id);
                resolve(stream);
              });
              // stream.on("close", () => {
              //   resolve(stream);
              // });
            })
        )
      );
    } catch (err) {
      console.error("errx", err);
    }
  }

  static log(msg) {
    if (true) {
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
