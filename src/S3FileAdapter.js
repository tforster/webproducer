("use strict");

// System dependencies (Built in modules)
const { Readable, Writable } = require("stream");

// Third party dependencies (Typically found in public NPM packages)
const AWS = require("aws-sdk");
const micromatch = require("micromatch");
const Vinyl = require("vinyl");

// Project dependencies

/**
 * Implements Gulp-like dest() function to terminate a piped process by uploading the supplied Vinyl file to AWS S3
 * @class S3FileAdapter
 */
class S3FileAdapter {
  /**
   * Creates an instance of S3FileAdapter.
   * @param {object} options: A hash of options
   * @memberof S3FileAdapter
   */
  constructor(options) {
    // Set objectMode true as we are processing whole Vinyl files, not chunks of a single file
    this.options = options;
    this.s3 = new AWS.S3({ region: options.region });

    // https://github.com/nodejs/node-v0.x-archive/issues/3045
    this.FS_MODES = {
      S_IFREG: 32768, // regular file
      S_IFDIR: 16384, // directory
    };
  }

  /**
   * @param {string} globs: A glob pattern
   * @returns {method}:     Returns a new instance of the private method ._src()
   * @memberof S3FileAdapter
   */
  src(globs, head = false) {
    const self = new S3FileAdapter(this.options);
    self.keys = null;

    // Call our override method
    return self._src(globs, head);
  }

  /**
   *
   *
   * @param {string} globs:       A glob pattern
   * @param {boolean} head:       Used to determine whether to fetch full file contents or just ETag headers
   * @returns {Readable Stream}:  A stream populated with entries matching the provided glob
   * @memberof S3FileAdapter
   */
  _src(globs, head) {
    const self = this;

    // Convert single string globs to an array
    if (!Array.isArray(globs)) {
      globs = [globs];
    }

    const readable = new Readable({ objectMode: true, highWaterMark: 64 });
    readable._read = async function () {
      if (!self.keys) {
        // First time here, let's seed the keys array with data from S3 source

        try {
          // Get list of all key objects
          // ! Max is 1000. This code does not handle > 1000 keys at this time but Prefix filtering should get us a long way.
          self.keys = (
            await self.s3
              .listObjectsV2({
                Bucket: self.options.bucket, // Bucket name originally from the constructor
                Prefix: self.options.base, // Use the base as a prefix to filter. E.g. prefix = /src/stage
              })
              .promise()
          ).Contents;

          // Map to remove extraneous properties and get us to an array of just Keys
          self.keys = self.keys.map((mappedKey) => mappedKey.Key);

          // Filter the list of Keys based on the glob
          self.keys = micromatch(self.keys, globs);
        } catch (err) {
          switch (err.code) {
            case "NoSuchBucket":
              console.error("ERR: Bucket not found", self.options.bucket, self.options.region);
              break;
            case "AccessDenied":
              console.error("ERR: Bucket access denied", self.options.bucket);
              throw err;
            default:
              console.error("ERR: Bucket error to be added to s3._read", self.options.bucket, self.options.region);
          }
          throw err;
        }
      }

      // If there are no more keys then push null to signal the end of the stream
      if (self.keys.length === 0) {
        readable.push(null);
        self.keys = null;
        return;
      }

      // Pop the oldest key off the top of the array FIFO style
      const key = self.keys.pop();

      // Start creating our Vinyl object params. Remove any prefix path like /src/stage or /dist/prod
      const prefix = new RegExp(`^${self.options.base}/`);
      const vinylParams = { path: key.replace(prefix, "") };

      // TODO: This is absolutely BRUTE-FORCE, copy/paste duplicated, and FUGLY code that must be refactored!
      if (head) {
        try {
          const s3Object = await self.s3
            .headObject({
              Bucket: self.options.bucket,
              Key: key,
            })
            .promise();

          // Set the directory or file details, as determined by the key, in our Vinyl object params
          if (key.match(/\/$/) > "") {
            // Is directory so set mode and leave contents as null
            vinylParams.stat = { mode: 16384 };
          } else {
            // Is file, so set contents
            vinylParams.stat = { mode: 0 };
            // ! JSON.parse() required! S3 returns in the format ""1f077ad7e6b4bf07910a0c5b9f654e6c"" but we do not know why yet
            vinylParams.eTag = JSON.parse(s3Object.ETag);
            vinylParams.size = s3Object.ContentLength;
          }
          // Create a new Vinyl object
          const vinyl = new Vinyl(vinylParams);

          // Push the Vinyl object into the stream
          readable.push(vinyl);
        } catch (err) {
          console.error("s3FileAdapter._read()", err, key, vinylParams);
          throw err;
        }
      } else {
        // Fetch the data from S3
        try {
          const s3Object = await self.s3
            .getObject({
              Bucket: self.options.bucket,
              Key: key,
            })
            .promise();

          // Create a Vinyl object using data obtained from the glob, the micromatch and the S3 getObject results
          const vinyl = self._vinyl(micromatch.scan(globs[0]), key, Buffer.from(s3Object.Body));

          // Push the Vinyl object into the stream
          readable.push(vinyl);
        } catch (err) {
          console.error("s3FileAdapter._read()", err, key, vinylParams);
          throw err;
        }
      }
    };

    return readable;
  }

  /**
   * Utility handler for easily creating Vinyl files. Currently used by _src() but should be moved to Utils and made available to
   * a wider range of modules.
   * @param {object} globPattern: An object containing results of the micromatch including the glob base. e.g. stage/db
   * @param {string} globbedPath: The path. e.g. stage/db/query.graphql
   * @param {Buffer} contents:    An optional Buffer with the file contents (would be empty for a directory)
   * @returns:                    A fully qualified Vinyl object c/w contents (if applicable) and fsStat value
   * @memberof S3FileAdapter
   */
  _vinyl(globPattern, globbedPath, contents) {
    // Create the file mode based on the presence of a trailing slash
    const stat = globbedPath.match(/\/$/) > "" ? this.FS_MODES.S_IFDIR : this.FS_MODES.S_IFREG;

    // Parameters object to pass to the Vinyl constructor
    const vinylParams = {
      cwd: "/",
      // base: will default to cwd if it is not included
      path: globbedPath.replace(globPattern.base, ""),
      contents,
      stat,
    };

    return new Vinyl(vinylParams);
  }

  /**
   * Allows a readable stream to upload files to S3 for web serving
   *
   * @static
   * @param {object} config:      The parsed S3 data from config.yml
   * @param {string} [folder=""]: The optional folder in the S3 bucket to write to (e.g. /dist/prod, etc)
   * @returns {WritableStream}:   A writeable stream
   * @memberof S3FileAdapter
   */
  static dest(config, folder = "") {
    const Bucket = config.bucket;
    const s3 = new AWS.S3({ region: config.region });

    return new Writable({
      objectMode: true,

      write: async function (file, _, done) {
        // Construct the slug, aka Key because we pass it to the S3 upload() method.
        const Key = require("path").join(folder, file.relative);

        const params = {
          Bucket,
          Key,
          Body: file.contents,
          ACL: config.acl || "public-read",
        };

        // Setting the content type is enabled by default but can disabled in webrpoducer.yml
        if (file.contentType) {
          params.ContentType = file.contentType;
        }

        if (file.redirect && file.redirect === 301) {
          params.WebsiteRedirectLocation = file.targetAddress;
        }

        // TODO: regardless of .html status, should we assume to set contenttype? Or do we make it config param

        await s3
          .upload(params)
          .promise()
          .catch((reason) => {
            console.error("S3FileAdapter.dest:s3.upload:", reason);
            throw reason;
          });
        done();
      },
      // end: function (x) {
      //   console.log("FINISHED:", x)
      // }
    });
  }
}

module.exports = S3FileAdapter;
