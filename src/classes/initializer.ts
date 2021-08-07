/**
 * Create a new Actionhero Initializer. The required properties of an initializer. These can be defined statically (this.name) or as methods which return a value.
 */
export abstract class Initializer {
  /**The name of the Initializer. */
  name: string;
  /**What order should this Initializer load at (Default: 1000, Actionhero core methods are < 1000) */
  loadPriority?: number;
  /**What order should this Initializer start at (Default: 1000, Actionhero core methods are < 1000) */
  startPriority?: number;
  /**What order should this Initializer stop at (Default: 1000, Actionhero core methods are < 1000) */
  stopPriority?: number;

  constructor() {
    this.name = null;
    this.loadPriority = 1000;
    this.startPriority = 1000;
    this.stopPriority = 1000;
  }

  /**
   * Method run as part of the `initialize` lifecycle of your server.  Usually sets api['YourNamespace']
   */
  async initialize?(): Promise<void>;

  /**
   * Method run as part of the `start` lifecycle of your server.  Usually connects to remote servers or processes..
   */
  async start?(): Promise<void>;

  /**
   * Method run as part of the `initialize` lifecycle of your server.  Usually disconnects from remote servers or processes.
   */
  async stop?(): Promise<void>;

  validate() {
    if (!this.name) {
      throw new Error("name is required for this initializer");
    }
    const priorities = [
      "loadPriority",
      "startPriority",
      "stopPriority",
    ] as const;

    priorities.forEach((priority) => {
      if (
        !this[priority] ||
        typeof this[priority] !== "number" ||
        this[priority] < 0
      ) {
        throw new Error(
          `${priority} is a required property for the initializer \`${this.name}\``
        );
      }
    });
  }
}
