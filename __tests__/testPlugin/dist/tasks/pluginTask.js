"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../../../src/index");
class PluginTask extends index_1.Task {
    constructor() {
        super();
        this.name = "pluginTask";
        this.description = "pluginTask";
        this.frequency = 0;
        this.queue = "default";
    }
    async run(params) {
        return true;
    }
}
exports.PluginTask = PluginTask;
