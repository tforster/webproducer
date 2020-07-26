("use strict");

// Third party dependencies (Typically found in public NPM packages)
const through = require("through2");
const Vinyl = require("vinyl");
const zip = new require("jszip")();

/**
 * Transform stream multiple Vinyl files to a single Vinyl file representing the zipped contents
 * @class ZipFileAdapter
 */
class ZipFileAdapter {
  static zip(archiveName = "archive.zip") {
    return through.obj(
      (file, _, done) => {
        zip.file(file.relative, file.contents);
        done(null);
      },
      function (done) {
        this.push(
          new Vinyl({
            path: archiveName,
            /* streamFiles: false is required to ensure no "only DEFLATED entries can have EXT descriptor" error from AWS Amplify. See more at:
               - https://stuk.github.io/jszip/documentation/api_jszip/generate_async.html#streamfiles-option 
               - https://stackoverflow.com/questions/47208272/android-zipinputstream-only-deflated-entries-can-have-ext-descriptor 
            */
            contents: zip.generateNodeStream({ type: "nodebuffer", streamFiles: false }),
          })
        );
        done();
      }
    );
  }
}

module.exports = ZipFileAdapter;
