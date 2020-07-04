("use strict");

// System dependencies (Built in modules)
const { PassThrough } = require("stream");

/**
 * Merges multiple streams into one
 *
 * @class MergeStream
 */
class MergeStream {
  /**
   * Creates an instance of MergeStream.
   * @param {[stream]} streams: An array of streams
   * @memberof MergeStream
   */
  constructor(streams) {
    // An array to track all the input streams so they can each be removed as they complete
    this.inputStreams = [];
    // The output stream that will be returned to the caller
    this.outputStream = new PassThrough({ objectMode: true });

    // Iterate the array of streams calling the add() method for each
    streams.forEach((stream) => this._merge(stream));

    // Return the new merged stream
    return this.outputStream;
  }

  /**
   * Merges the provided stream to the outputStream
   *
   * @param {stream} inputStream:  An input stream to be merged
   * @memberof MergeStream
   */
  _merge(inputStream) {
    const self = this;

    // Add the sourceStream to the array tracking the state of all the merged input streams
    this.inputStreams.push(inputStream);

    // Set up the on end handler for the sourceStream
    inputStream.on("end", () => {
      console.log(`>>> Unmerged ${inputStream.name}`);

      // Decrement the input streams until none remain and we can manually force end() on the outputStream
      self.inputStreams = self.inputStreams.filter((s) => s !== inputStream);
      if (!self.inputStreams.length && self.outputStream.readable) {
        self.outputStream.end();
      }
    });

    inputStream.on("error", function (err) {
      console.log("error", err);
      this.output.emit.bind(this.output, "error");
    });

    // Immediately start reading the contents of this sourceStream and piping to the outputStream
    inputStream.pipe(this.outputStream, { end: false });
    console.log(`>>> Merged ${inputStream.name}`);
  }
}

module.exports = MergeStream;
