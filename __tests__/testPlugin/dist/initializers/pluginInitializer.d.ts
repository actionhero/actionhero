import { Initializer } from "../../../../src/index";
export declare class PluginInitializer extends Initializer {
    constructor();
    initialize(): Promise<void>;
    stop(): Promise<void>;
}
