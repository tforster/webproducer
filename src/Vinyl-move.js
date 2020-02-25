("use strict");

// System dependencies (Built in modules)
const { Transform } = require("stream");

class VinylMove extends Transform {
  constructor(options) {
    super({ objectMode: true });
    this.options = options;
  }

  _transform(file, _, done) {
    file.base = this.options.to;
    done(null, file);
  }
}

module.exports = VinylMove;
