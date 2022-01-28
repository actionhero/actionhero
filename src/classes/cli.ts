/**
 * An Actionhero CLI Command.
 * For inputs, you can provide Options (--thing=stuff) with the "Inputs" object, or define Arguments in the name of the command (`greet [name]`)
 */
export abstract class CLI {
  /**The name of the CLI command. */
  name: string;
  /**The description of the CLI command (default this.name) */
  description: string;
  /**An example of how to run this CLI command */
  example: string;
  /**The inputs of the CLI command (default: {}) */
  inputs: {
    [key: string]: {
      required?: boolean;
      requiredValue?: boolean;
      default?: string | boolean;
      letter?: string;
      flag?: boolean;
      placeholder?: string;
      variadic?: boolean;
      description?: string;
      formatter?: Function;
      validator?: Function;
    };
  };

  /** Should the server initialize before running this command? */
  initialize: boolean;

  /** Should the server start before running this command? */
  start: boolean;

  constructor() {
    this.description = this.description ?? this.name;
    this.example = this.example ?? "";
    this.inputs = this.inputs ?? {};
    this.initialize = this.initialize ?? true;
    this.start = this.start ?? false;
  }

  /**
   * The main "do something" method for this CLI command.  It is an `async` method.
   * If error is thrown in this method, it will be logged to STDERR, and the process will terminate with a non-0 exit code.
   */

  abstract run(data: { [key: string]: any }): Promise<boolean>;

  /**
   * An optional method to append additional information to the --help response for this CLI command
   */
  help() {}

  validate() {
    if (!this.name) {
      throw new Error("name is required for this cli command");
    }
    if (!this.description) {
      throw new Error(
        `description is required for the cli commend \`${this.name}\``
      );
    }
    if (!this.run || typeof this.run !== "function") {
      throw new Error(`cli command \`${this.name}\` has no run method`);
    }
  }
}
