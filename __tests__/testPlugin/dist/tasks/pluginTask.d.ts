import { Task } from "../../../../src/index";
export declare class PluginTask extends Task {
    constructor();
    run(params: any): Promise<boolean>;
}
