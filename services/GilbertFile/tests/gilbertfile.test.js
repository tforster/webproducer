import { test, describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import fs from "node:fs"; // For fs.Stats

import GilbertFile from "../index.js";

// Constants for modes (align with GilbertFile if they are defined there, otherwise define here)
const DEFAULT_FILE_MODE = 0o100644; // Example, adjust if GilbertFile uses different defaults
const DEFAULT_DIR_MODE = 0o040755; // Example, adjust if GilbertFile uses different defaults

describe("GilbertFile", () => {
  describe("Constructor", () => {
    it("should create a new GilbertFile with defaults", () => {
      const file = new GilbertFile({ path: "test.txt", contents: Buffer.from("test") });
      assert.ok(file instanceof GilbertFile, "file should be an instance of GilbertFile");
      assert.strictEqual(file.path, path.resolve(process.cwd(), "test.txt"), "Path should be resolved");
      assert.ok(Buffer.isBuffer(file.contents), "Contents should be a Buffer");
      assert.strictEqual(file.contents.toString(), "test", "Contents should match");
      assert.strictEqual(file.cwd, process.cwd(), "CWD should default to process.cwd()");
      assert.strictEqual(file.base, process.cwd(), "Base should default to CWD");
      assert.ok(file.stat, "Stat object should exist");
      assert.strictEqual(file.stat.mode, null, "Stat mode should be null for now");
      assert.deepStrictEqual(file.history, [path.resolve(process.cwd(), "test.txt")], "History should contain initial path");
      assert.strictEqual(file._isVinyl, true, "_isVinyl flag should be true");
    });

    it("should create a file with null contents (directory-like)", () => {
      const file = new GilbertFile({ path: "test-dir" }); // No contents, implies null
      assert.strictEqual(file.contents, null, "Contents should be null");
      assert.ok(file.stat, "Stat object should exist");
      assert.strictEqual(file.stat.mode, null, "Stat mode should be null for now");
      assert.strictEqual(file.isNull(), true, "isNull() should be true");
      assert.strictEqual(file.isDirectory(), true, "isDirectory() should be true for null contents by default");
    });

    it("should accept custom cwd and base", () => {
      const customCwd = "/custom/cwd";
      const customBase = "base"; // relative to customCwd
      const file = new GilbertFile({ path: "file.txt", cwd: customCwd, base: customBase });
      assert.strictEqual(file.cwd, customCwd, "CWD should be custom CWD");
      assert.strictEqual(file.base, path.resolve(customCwd, customBase), "Base should be resolved relative to custom CWD");
      assert.strictEqual(file.path, path.resolve(customCwd, "file.txt"), "Path should be resolved relative to custom CWD");
    });

    it("should accept a Buffer for contents", () => {
      const buffer = Buffer.from("hello world");
      const file = new GilbertFile({ path: "file.txt", contents: buffer });
      assert.strictEqual(file.contents, buffer, "Contents should be the provided Buffer");
      assert.strictEqual(file.isBuffer(), true, "isBuffer() should be true");
    });

    it("should accept a Stream for contents", () => {
      const stream = new Readable({ read() {} });
      const file = new GilbertFile({ path: "file.txt", contents: stream });
      assert.strictEqual(file.contents, stream, "Contents should be the provided Stream");
      assert.strictEqual(file.isStream(), true, "isStream() should be true");
    });

    it("should throw if path is not a string when provided", () => {
      assert.throws(() => new GilbertFile({ path: 123 }), Error, "Should throw if path is not a string");
    });

    it("should throw if cwd is not a string when provided", () => {
      assert.throws(() => new GilbertFile({ path: "file.txt", cwd: 123 }), Error, "Should throw if cwd is not a string");
    });

    it("should throw if base is not a string when provided", () => {
      assert.throws(() => new GilbertFile({ path: "file.txt", base: 123 }), Error, "Should throw if base is not a string");
    });

    it("should throw if contents are invalid", () => {
      assert.throws(() => new GilbertFile({ path: "file.txt", contents: 123 }), Error, "Should throw for invalid contents type");
    });

    it("should initialize history with the initial path", () => {
      const p = "initial/path.txt";
      const file = new GilbertFile({ path: p });
      assert.deepStrictEqual(file.history, [path.resolve(process.cwd(), p)], "History should contain the initial resolved path");
    });

    it("should handle path resolution correctly when cwd is provided", () => {
      const file = new GilbertFile({ cwd: "/foo/bar", path: "baz/file.txt" });
      assert.strictEqual(file.path, "/foo/bar/baz/file.txt");
    });

    it("should handle path resolution correctly when path is absolute", () => {
      const file = new GilbertFile({ cwd: "/foo/bar", path: "/abs/path/file.txt" });
      assert.strictEqual(file.path, "/abs/path/file.txt");
    });

    it("should handle base path resolution correctly", () => {
      const file = new GilbertFile({ cwd: "/foo/bar", base: "baz", path: "baz/qux/file.txt" });
      assert.strictEqual(file.base, "/foo/bar/baz");
      assert.strictEqual(file.relative, "qux/file.txt");
    });

    it("should default base to cwd if path is supplied and base is not", () => {
      const file = new GilbertFile({ cwd: "/app", path: "src/file.js" });
      assert.strictEqual(file.base, "/app");
    });
  });

  describe("Properties", () => {
    const filePath = "dir/file.txt";
    const resolvedPath = path.resolve(process.cwd(), filePath);
    const cwd = process.cwd();
    const base = path.resolve(cwd, "dir");
    let file;

    beforeEach(() => {
      file = new GilbertFile({ path: filePath, base: "dir", contents: Buffer.from("test") });
    });

    it("should get cwd", () => {
      assert.strictEqual(file.cwd, cwd);
    });

    it("should get base", () => {
      assert.strictEqual(file.base, base);
    });

    it("should get path", () => {
      assert.strictEqual(file.path, resolvedPath);
    });

    it("should get contents", () => {
      assert.ok(Buffer.isBuffer(file.contents));
      assert.strictEqual(file.contents.toString(), "test");
    });

    it("should set contents (Buffer)", () => {
      const newBuffer = Buffer.from("new content");
      file.contents = newBuffer;
      assert.strictEqual(file.contents, newBuffer);
      assert.strictEqual(file.isBuffer(), true);
    });

    it("should set contents (Stream)", () => {
      const newStream = new Readable({ read() {} });
      file.contents = newStream;
      assert.strictEqual(file.contents, newStream);
      assert.strictEqual(file.isStream(), true);
    });

    it("should set contents (null)", () => {
      file.contents = null;
      assert.strictEqual(file.contents, null);
      assert.strictEqual(file.isNull(), true);
    });

    it("should get stat", () => {
      assert.ok(file.stat);
    });

    it("should get history", () => {
      assert.deepStrictEqual(file.history, [resolvedPath]);
    });

    it("should get _isVinyl", () => {
      assert.strictEqual(file._isVinyl, true);
    });

    it("should get relative path", () => {
      assert.strictEqual(file.relative, "file.txt");
    });

    it("should get dirname", () => {
      assert.strictEqual(file.dirname, base); // Since base is 'dir'
    });

    it("should get basename", () => {
      assert.strictEqual(file.basename, "file.txt");
    });

    it("should get extname", () => {
      assert.strictEqual(file.extname, ".txt");
    });

    it("should get stem", () => {
      assert.strictEqual(file.stem, "file");
    });

    it("should get contentType (MIME type)", () => {
      const txtFile = new GilbertFile({ path: "doc.txt", contents: Buffer.from("") });
      assert.strictEqual(txtFile.contentType, "text/plain");
      const htmlFile = new GilbertFile({ path: "index.html", contents: Buffer.from("") });
      assert.strictEqual(htmlFile.contentType, "text/html");
      const unknownFile = new GilbertFile({ path: "file.unknown", contents: Buffer.from("") });
      assert.strictEqual(unknownFile.contentType, "application/octet-stream", "Should be null for unknown extension by default");
    });

    it("should set contentType (MIME type)", () => {
      file.contentType = "application/json";
      assert.strictEqual(file.contentType, "application/json");
    });
  });

  describe("Methods", () => {
    it("isBuffer() should return true for Buffer contents", () => {
      const file = new GilbertFile({ contents: Buffer.from("test") });
      assert.strictEqual(file.isBuffer(), true);
      assert.strictEqual(file.isStream(), false);
      assert.strictEqual(file.isNull(), false);
    });

    it("isStream() should return true for Stream contents", () => {
      const file = new GilbertFile({ contents: new Readable({ read() {} }) });
      assert.strictEqual(file.isStream(), true);
      assert.strictEqual(file.isBuffer(), false);
      assert.strictEqual(file.isNull(), false);
    });

    it("isNull() should return true for null contents", () => {
      const file = new GilbertFile({ contents: null });
      assert.strictEqual(file.isNull(), true);
      assert.strictEqual(file.isBuffer(), false);
      assert.strictEqual(file.isStream(), false);
    });

    describe("isDirectory()", () => {
      it("should be true if contents are null and stat does not deny it", () => {
        const file = new GilbertFile({ path: "dir", contents: null });
        assert.strictEqual(file.isDirectory(), true);
      });
      it("should be true if stat.isDirectory() is true", () => {
        const file = new GilbertFile({
          path: "dir",
          stat: { isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
        });
        assert.strictEqual(file.isDirectory(), true);
      });
      it("should be false if stat.isDirectory() is false, even with null contents", () => {
        const file = new GilbertFile({
          path: "dir",
          contents: null,
          stat: { isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
        });
        assert.strictEqual(file.isDirectory(), false);
      });
      it("should be false for file with buffer contents", () => {
        const file = new GilbertFile({ path: "file.txt", contents: Buffer.from("data") });
        assert.strictEqual(file.isDirectory(), false);
      });
    });

    describe("isFile()", () => {
      it("should be true for buffer contents if not a directory or symlink", () => {
        const file = new GilbertFile({ path: "file.txt", contents: Buffer.from("data") });
        assert.strictEqual(file.isFile(), true);
      });

      it("should be false for null contents (defaulting to directory)", () => {
        const file = new GilbertFile({ path: "dir", contents: null });
        assert.strictEqual(file.isFile(), false);
      });
    });

    describe("isSymbolic()", () => {
      it("should be true if null contents, stat exists, and stat.isSymbolicLink() is true", () => {
        const file = new GilbertFile({
          path: "link",
          contents: null,
          stat: { isSymbolicLink: () => true, isDirectory: () => false, isFile: () => false },
        });
        assert.strictEqual(file.isSymbolic(), true);
      });
      it("should be false if contents are not null", () => {
        const file = new GilbertFile({ path: "link", contents: Buffer.from(""), stat: { isSymbolicLink: () => true } });
        assert.strictEqual(file.isSymbolic(), false);
      });
    });
  });
});
