// Third party dependencies
import Vinyl from "vinyl";
import GilbertFile from "/home/tforster/dev/TechSmarts/WebProducer/Gilbert/services/GilbertFile/index.js";
import { Readable } from "node:stream"; // Added for type checking
import { Buffer } from "node:buffer"; // Added for type checking (though Buffer is global)

class Utils {
  // static hasInspected = false; // Flag to ensure inspection runs only once // Can be removed or kept commented
  /**
   * @description: Lightweight wrapper around the Vinyl constructor for simplicity and consistency.
   * @static
   * @param {object} vinylParams: Typical Vinyl params such as path and contents
   * @return {object}             A new Vinyl object
   * @memberof Utils
   */
  static vinyl(vinylParams) {
    // Force cwd to (virtual) root as it makes it MUCH easier to work with and debug
    vinylParams.cwd = vinylParams.cwd || "/";
    // return new Vinyl(vinylParams);
    const v = new Vinyl(vinylParams);
    const g = new GilbertFile(vinylParams);

    // You can call the comparison function here if you want to log every time:
    // Utils.compareVinylAndGilbert(v, g, `Comparison for ${vinylParams.path}`);
    return g; // Or return v based on your toggle
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
      console.error("errx", err);
    }
  }

  static log(msg) {
    // eslint-disable-next-line no-constant-condition
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

  /**
   * @description Compares a Vinyl object and a GilbertFile object for debugging.
   * @static
   * @param {Vinyl} vinylFile - The Vinyl file instance.
   * @param {GilbertFile} gilbertFile - The GilbertFile instance.
   * @param {string} [label='Comparison'] - A label for the comparison output.
   * @memberof Utils
   */
  static compareVinylAndGilbert(vinylFile, gilbertFile, label = "File Comparison") {
    console.log(`\\n--- ${label} ---`);

    // Updated based on inspection and focusing on GilbertFile's intended API subset
    const propertiesToCompare = [
      "base",
      "basename",
      "contents",
      "cwd",
      "dirname",
      "extname",
      "path",
      "relative",
      "stat",
      "stem",
    ].sort();

    // Updated based on inspection and GilbertFile's API
    // isFile is specific to GilbertFile based on recent inspection of Vinyl
    const methodsToCompare = ["isBuffer", "isDirectory", "isNull", "isStream", "isSymbolic"].sort();

    console.log("** Properties **");
    propertiesToCompare.forEach((prop) => {
      const vProp = vinylFile[prop];
      const gProp = gilbertFile[prop];
      console.log(`Vinyl.${prop}:`, vProp);
      console.log(`Gilbert.${prop}:`, gProp);
      if (vProp !== gProp) {
        console.warn(`  MISMATCH for ${prop}: Vinyl ('${vProp}') vs Gilbert ('${gProp}')`);
      }
    });

    console.log("\n** Contents **");
    const vContents = vinylFile.contents;
    const gContents = gilbertFile.contents;

    if (Buffer.isBuffer(vContents) && Buffer.isBuffer(gContents)) {
      console.log("Vinyl.contents: Buffer, length", vContents.length);
      console.log("Gilbert.contents: Buffer, length", gContents.length);
      if (vContents.length !== gContents.length) {
        console.warn("  MISMATCH for Buffer contents length");
      } else if (!vContents.equals(gContents)) {
        console.warn("  MISMATCH for Buffer contents (values differ)");
      }
    } else if (vContents instanceof Readable && gContents instanceof Readable) {
      console.log("Vinyl.contents: Stream");
      console.log("Gilbert.contents: Stream");
      // Note: Comparing stream instances directly for equality is usually not meaningful.
      // You'd compare their output if needed, which is outside this basic comparison.
    } else if (vContents === null && gContents === null) {
      console.log("Vinyl.contents: null");
      console.log("Gilbert.contents: null");
    } else {
      console.log("Vinyl.contents:", vContents);
      console.log("Gilbert.contents:", gContents);
      if (typeof vContents !== typeof gContents || vContents !== gContents) {
        console.warn("  MISMATCH or unhandled type for contents");
      }
    }

    console.log("\n** Stat Object **");
    const vStat = vinylFile.stat;
    const gStat = gilbertFile.stat;
    // Custom stringify to handle potential circular refs or complex objects if any, though unlikely for stat
    const stringifyStat = (statObj) => {
      if (!statObj) return String(statObj);
      return JSON.stringify(
        {
          mode: statObj.mode,
          uid: statObj.uid,
          gid: statObj.gid,
          size: statObj.size,
          atime: statObj.atime,
          mtime: statObj.mtime,
          ctime: statObj.ctime,
          // Add any other stat properties you typically rely on
        },
        (key, value) => (value instanceof Date ? value.toISOString() : value),
        2
      );
    };

    console.log("Vinyl.stat:", stringifyStat(vStat));
    console.log("Gilbert.stat:", stringifyStat(gStat));

    if (vStat && gStat) {
      if (vStat.mode !== gStat.mode) {
        console.warn(
          `  MISMATCH for stat.mode: Vinyl (${vStat.mode ? vStat.mode.toString(8) : "undef"}) vs Gilbert (${gStat.mode ? gStat.mode.toString(8) : "undef"})`
        );
      }
      // Add more specific stat property comparisons if needed
    } else if (vStat !== gStat) {
      // Handles one being null/undefined and the other not
      console.warn(`  MISMATCH for stat object existence: Vinyl (${vStat}) vs Gilbert (${gStat})`);
    }

    console.log("\n** Methods (Return Values) **");
    methodsToCompare.forEach((method) => {
      let vResult, gResult;
      let vError, gError;

      try {
        vResult = vinylFile[method]();
      } catch (e) {
        vError = e.message;
      }
      try {
        gResult = gilbertFile[method]();
      } catch (e) {
        gError = e.message;
      }

      console.log(`Vinyl.${method}():`, vError ? `Error: ${vError}` : vResult);
      console.log(`Gilbert.${method}():`, gError ? `Error: ${gError}` : gResult);

      if (vError || gError) {
        if (String(vError) !== String(gError)) {
          console.warn(`  MISMATCH in errors for ${method}(): Vinyl (${vError}) vs Gilbert (${gError})`);
        }
      } else if (vResult !== gResult) {
        console.warn(`  MISMATCH for ${method}(): Vinyl (${vResult}) vs Gilbert (${gResult})`);
      }
    });
    console.log(`--- End ${label} ---\n`);
  }
}

export const log = Utils.log;
export const streamsFinish = Utils.streamsFinish;
export const streamLog = Utils.streamLog;
export const vinyl = Utils.vinyl;
export const compareVinylAndGilbert = Utils.compareVinylAndGilbert;
