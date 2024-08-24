import { read } from "fs";
import { Readable } from "stream";
import { vinyl } from "./Utils.js";
import { timeStamp } from "console";

export default class Delme {
  constructor(parameters) {
    this.stream = new Readable({
      objectMode: true,
      read: function () {
        this.push(
          vinyl({
            path: "/abc",
            contents: Buffer.from("abcdef"),
          })
        );
        this.push(null);
      },
    });
  }
}
