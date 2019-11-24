/**
 * Create a new ActionHero CLI Command. The required properties of an CLI command. These can be defined statically (this.name) or as methods which return a value.
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
    [key: string]: any;
  };

  constructor() {
    const defaults = this.getDefaults();
    for (const key in defaults) {
      if (!this[key]) {
        this[key] = defaults[key];
      }
      if (typeof this[key] === "function") {
        this[key] = this[key]();
      }
    }
  }

  /**
   * The main "do something" method for this CLI command.  It is an `async` method.
   * If error is thrown in this method, it will be logged to STDERR, and the process will terminate with a non-0 exit code.
   */

  abstract run(data: { [key: string]: any }): Promise<boolean>;

  private getDefaults() {
    return {
      name: null,
      description: this.name,
      example: "",
      inputs: {}
    };
  }

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
