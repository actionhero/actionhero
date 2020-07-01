"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../../../src/index");
class PluginInitializer extends index_1.Initializer {
    constructor() {
        super();
        this.name = "pluginInitializer";
    }
    async initialize() {
        index_1.api.pluginInitializer = { here: true };
    }
    async stop() {
        // this seems silly, but is needed for testing, as we never clear properties on the API object
        delete index_1.api.pluginInitializer;
    }
}
exports.PluginInitializer = PluginInitializer;
