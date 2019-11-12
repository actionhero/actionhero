/**
 * Create a new ActionHero Task. The required properties of an task. These can be defined statically (this.name) or as methods which return a value.
 * ```js
 * const {Task, api} = require('actionhero')
 * module.exports = class SayHello extends Task {
 *  constructor () {
 *   super()
 *    this.name = 'sayHello'
 *    this.description = 'I say Hello every minute'
 *    this.frequency = (60 * 1000)
 *  }
 *  async run (data, worker) {
 *    api.log('Hello!')
 *  }
 * }
 * ```
 */

export abstract class Task {
  /**The name of the Task */
  name: string;
  /**The description of the Task (default this.name) */
  description: string;
  /**How often to run this Task, in ms.  0 is non-recurring. (default: 0) */
  frequency: number;
  /**The Middleware specific to this Task (default: []).  Middleware is descibed by the string names of the middleware */
  middleware: Array<string>;
  /**The default queue to run this Task on (default: 'default') */
  queue: string;
  /**Queuing a periodic task in the case of an exception.  (default: false) */
  reEnqueuePeriodicTaskIfException: boolean;

  constructor() {
    const coreProperties = this.defaults();
    for (const key in coreProperties) {
      if (!this[key]) {
        this[key] = coreProperties[key];
      }
      if (typeof this[key] === "function") {
        this[key] = this[key]();
      }
    }
  }

  /**
   * The main "do something" method for this task.  It can be `async`.  Anything returned from this metod will be logged.
   * If error is thrown in this method, it will be logged & caught.  Using middleware, you can decide to re-run the task on failure.
   * `this` is a Task instance itself now.
   *
   * @param data The data about this instance of the task, specifically params.
   * @param worker Instance of a node-resque worker. You can inspect `worker.job` and set `worker.result` explicitly if your Task does not return a value.
   */
  abstract run(data: TaskData, worker): void;

  private defaults() {
    return {
      name: null,
      description: this.name,
      frequency: 0,
      queue: "default",
      middleware: [],
      reEnqueuePeriodicTaskIfException: true
    };
  }

  private validate() {
    if (!this.name) {
      throw new Error("name is required for this task");
    }
    if (!this.description) {
      throw new Error(`description is required for the task \`${this.name}\``);
    }
    if (!this.queue) {
      throw new Error(`queue is required for the task \`${this.name}\``);
    }
    if (this.frequency === null || this.frequency === undefined) {
      throw new Error(`frequency is required for the task \`${this.name}\``);
    }
    if (!this.run || typeof this.run !== "function") {
      throw new Error(`task \`${this.name}\` has no run method`);
    }
  }
}

export interface TaskData {
  params: {
    [key: string]: any;
  };
}
