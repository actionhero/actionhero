"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../../../src/index");
module.exports = class PluginAction extends index_1.Action {
    constructor() {
        super();
        this.name = "pluginAction";
        this.description = "pluginAction";
        this.outputExample = {};
    }
    async run({ response }) {
        response.cool = true;
    }
};
