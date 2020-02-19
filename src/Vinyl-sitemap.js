("use strict");

// Third party dependencies (Typically found in public NPM packages)
const through = require("through2");
const Vinyl = require("vinyl");

/**
 * Transform stream multiple Vinyl files to a single Vinyl file representing the zipped contents
 * @class VinylZip
 */
class VinylSitemap {
  constructor() {
    this.sitemap = {};
    // <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
    /* <url>
    <loc>https://www.yourmentalwealthadvisors.com/</loc>
    <lastmod>2020-01-19T19:26:31+00:00</lastmod>
    <priority>1.00</priority>
    </url> */
  }

  sitemapf(archiveName = "archive.zip") {
    const _this = this;
    return through.obj(
      (file, _, done) => {
        _this.sitemap[file.name] = file.name;
        done(file);
      },
      function(done) {
        this.push(
          new Vinyl({
            path: "sitemap.xml",
            contents: JSON.stringify(_this.sitemap),
          })
        );
        done();
      }
    );
  }
}

module.exports = VinylSitemap;
