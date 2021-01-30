"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Hello = void 0;
const index_1 = require("../../../../src/index");
class Hello extends index_1.CLI {
    constructor() {
        super();
        this.name = "hello";
        this.description = "I say hello";
        this.inputs = {
            name: {
                required: true,
                description: 'Who we are greeting',
                letter: 'g',
                default: 'Actionhero'
            }
        };
    }
    async run({ params }) {
        console.log(`Hello, ${params.name}`);
        return true;
    }
}
exports.Hello = Hello;
