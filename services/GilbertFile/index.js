// System imports
import path from "node:path";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";

// Third-party imports
import mime from "mime";

// Constants
const DEFAULT_CONTENT_TYPE = "application/octet-stream";

/**
 * @description Implements a virtual file object for Gilbert to use in stream processing
 * @class GilbertFile
 */
class GilbertFile {
  // Private fields
  #cwd;
  #base;
  #path;
  #history;
  #contentKind;
  #contents;
  #stat;
  #contentType;
  #symlink = null;
  #isDirectory = false;

  /**
   * Creates an instance of GilbertFile.
   * @param {Object} [options={ base, cwd, path, contents, stat: null }]
   * @memberof GilbertFile
   */
  constructor(options = {}) {
    // Merge default options with provided options
    options = { ...{ base: null, cwd: null, path: null, contents: null, stat: {} }, ...options };

    // Check path is a string if provided
    if (options.path !== null && typeof options.path !== "string") {
      throw new Error("Path must be a string or null.");
    }

    // Initialise private fields
    this.#cwd = options.cwd || process.cwd();
    this.#base = path.resolve(this.#cwd, options.base || this.#cwd);

    // Resolve path if it's a string, otherwise use options.path (e.g., null)
    this.#path = typeof options.path === "string" ? path.resolve(this.#cwd, options.path) : options.path;
    this.#stat = options.stat;

    // Initialize contents (uses the setter)
    this.contents = options.contents;
    this.#isDirectory = options.contents === null;

    // Initialize MIME type (Uses the setter)
    this.contentType = mime.getType(this.path) || DEFAULT_CONTENT_TYPE;

    // Set Vinyl compatibility
    this._isVinyl = true;
    this._symlink = this.symlink;
    this._cwd = this.cwd;
    this._contents = this.contents;
    this.#history = [this.#path];
  }

  /**
   * @description Gets the current working directory.
   * @return {string}
   * @memberof GilbertFile
   */
  get cwd() {
    return this.#cwd;
  }

  /**
   * @description Sets the current working directory.
   * @param {string} val  The new current working directory to set.
   * @memberof GilbertFile
   */
  set cwd(val) {
    if (typeof val !== "string") {
      throw new Error("CWD must be a string.");
    }

    // Update base and path based on new cwd
    this.#base = path.resolve(val, this.#base);
    if (this.#path) {
      this.#path = path.resolve(val, this.#path);
    }

    this.#cwd = val;
  }

  /**
   * @description Gets the absolute path of the file.
   * @return {string}
   * @memberof GilbertFile
   */
  get path() {
    return this.#path;
  }

  /**
   * @description Sets the absolute path of the file.
   * @param {string} val  The absolute path to set.
   * @memberof GilbertFile
   */
  set path(val) {
    if (typeof val !== "string") {
      throw new Error("Path must be a string.");
    }

    this.#path = path.resolve(this.#cwd, val);

    // The history getter is used by VinylFs
    this.#history = [this.#path];
  }

  /**
   * @description Gets the base directory for relative path calculations.
   * @return {string}
   * @memberof GilbertFile
   */
  get base() {
    return this.#base;
  }

  /**
   * @description Sets the base directory for relative path calculations.
   * @param {string} val  The base directory to set.
   * @return {string}
   * @memberof GilbertFile
   */
  set base(val) {
    if (typeof val !== "string") {
      throw new Error("Base must be a string.");
    }
    if (val !== this.#cwd) {
      this.#base = val;
    } else {
      this.#base = null;
    }
  }

  /**
   * @description Gets the symlink for the file
   * @return {string}
   * @memberof GilbertFile
   */
  get symlink() {
    return this.#symlink;
  }

  /**
   * @description Gets the history of paths for the file.
   * @return {string[]}
   * @vinylCompatibility
   * @readonly
   * @memberof GilbertFile
   */
  get history() {
    return this.#history;
  }

  /**
   * @description Gets the contents of the file (Buffer, Stream, or null).
   * @return {Buffer|Readable|null}
   * @memberof GilbertFile
   */
  get contents() {
    return this.#contents;
  }

  /**
   * @description Sets the contents of the file (Buffer, Stream, or null). Used by the constructor.
   * @param {Buffer|Readable|null} newContents  The new contents to set.
   * @memberof GilbertFile
   */
  set contents(newContents) {
    if (newContents !== null && !Buffer.isBuffer(newContents) && typeof newContents.pipe !== "function") {
      throw new Error("Contents must be a Buffer, a Stream, or null.");
    }
    this.#contents = newContents;

    // Determine #contentKind based on newContents
    if (Buffer.isBuffer(newContents)) {
      this.#contentKind = "buffer";
    } else if (newContents && typeof newContents.pipe === "function") {
      this.#contentKind = "stream";
    } else if (newContents === null) {
      this.#contentKind = "null";
    } else {
      this.#contentKind = "unknown";
    }
  }

  /**
   * @description Gets the file extension.
   * @return {string}
   * @vinylCompatibility
   * @readonly
   * @memberof GilbertFile
   */
  get extname() {
    return path.extname(this.path);
  }

  /**
   * @description Gets the MIME type of the file.
   * @return {string}
   * @memberof GilbertFile
   */
  get contentType() {
    return this.#contentType;
  }

  /**
   * @description Sets the MIME type of the file
   * @param {string} val  The MIME type to set.
   * @memberof GilbertFile
   */
  set contentType(val) {
    this.#contentType = val;
  }

  /**
   * @description Gets the relative path of the file from the base directory.
   * @return {string}
   * @memberof GilbertFile
   */
  get relative() {
    return path.relative(this.#base, this.path);
  }

  /**
   * @description Gets the stem (filename without suffix) of file.path.
   * @readonly
   * @memberof GilbertFile
   */
  get stem() {
    return path.basename(this.path, this.extname);
  }

  /**
   * @description Gets the directory name of file.path.
   * @readonly
   * @memberof GilbertFile
   */
  get dirname() {
    return path.dirname(this.path);
  }

  /**
   * @description
   * @readonly
   * @memberof GilbertFile
   */
  get basename() {
    return path.basename(this.path);
  }

  /**
   * @description Gets the fs.Stats-like object for the file.
   * This is typically null unless explicitly set or provided in the constructor.
   * @memberof GilbertFile
   */
  get stat() {
    return this.#stat;
  }

  /**
   * @description Sets the fs.Stats-like object for the file.
   * @memberof GilbertFile
   */
  set stat(newStat) {
    this.#stat = newStat;
  }

  /**
   * @description Checks if the contents are a Buffer.
   * @return {boolean}
   * @memberof GilbertFile
   */
  isBuffer() {
    return this.#contentKind === "buffer";
  }

  /**
   * @description Checks if the contents are a Stream.
   * @return {boolean}
   * @memberof GilbertFile
   */
  isStream() {
    return this.#contentKind === "stream";
  }

  /**
   * @description Checks if the contents are null.
   * @return {boolean}
   * @memberof GilbertFile
   */
  isNull() {
    return this.#contentKind === "null";
  }

  /**
   * @description Checks if the GilbertFile object represents a directory.
   * @vinylCompatibility
   * @return {boolean}
   * @memberof GilbertFile
   */
  isDirectory() {
    return this.#isDirectory;
  }

  /**
   * @description Checks if the GilbertFile object represents a regular file.
   * @vinylCompatibility
   * @return {boolean}
   * @memberof GilbertFile
   */
  isFile() {
    return !this.isDirectory() && !this.isSymbolic();
  }

  /**
   * @description Checks if the GilbertFile object represents a symbolic link.
   * Mimics Vinyl's behavior based on README:
   * - file.isNull() is true
   * - file.stat is an object
   * - file.stat.isSymbolicLink() returns true
   * @vinylCompatibility
   * @return {boolean}
   * @memberof GilbertFile
   */
  isSymbolic() {
    // As per user-provided Vinyl README:
    // A file is considered symbolic when:
    // * file.isNull() is true
    // * file.stat is an object
    // * file.stat.isSymbolicLink() returns true
    // return this.isNull();
    return false;
  }
}

export default GilbertFile;
