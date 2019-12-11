"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../../../src/index");
class Version extends index_1.CLI {
    constructor() {
        super();
        this.name = "hello";
        this.description = "I say hello";
    }
    async run() {
        console.log("hello");
        return true;
    }
}
exports.Version = Version;
