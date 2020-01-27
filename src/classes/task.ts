/**
 * Create a new ActionHero Task. The required properties of an task. These can be defined statically (this.name) or as methods which return a value.
 * ```js
 * const { Task, api, log } = require('actionhero')
 * module.exports = class SayHello extends Task {
 *  constructor () {
 *   super()
 *    this.name = 'sayHello'
 *    this.description = 'I say Hello every minute'
 *    this.frequency = (60 * 1000)
 *  }
 *  async run (data, worker) {
 *    log('Hello!')
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
  /**The Middleware specific to this Task (default: []).  Middleware is described by the string names of the middleware */
  middleware: Array<string>;
  /**Plugins from node-resque to use on this task (default: []).  Plugins like `QueueLock can be applied` */
  plugins: Array<string>;
  /**Options for the node-resque plugins. */
  pluginOptions: { [key: string]: any };
  /**The default queue to run this Task on (default: 'default') */
  queue: string;
  /**Re-enqueuing a periodic task in the case of an exception.  (default: false) */
  reEnqueuePeriodicTaskIfException: boolean;

  constructor() {
    const coreProperties = this.defaults();
    for (const key in coreProperties) {
      if (!this[key]) {
        this[key] = coreProperties[key];
      }
    }
  }

  /**
   * The main "do something" method for this task.  It can be `async`.  Anything returned from this method will be logged.
   * If error is thrown in this method, it will be logged & caught.  Using middleware, you can decide to re-run the task on failure.
   * `this` is a Task instance itself now.
   *
   * Inputs:
   * * data: The data about this instance of the task, specifically params.
   * * worker: Instance of a node-resque worker. You can inspect `worker.job` and set `worker.result` explicitly if your Task does not return a value.
   */
  abstract async run(data: TaskData, worker): Promise<any>;

  private defaults() {
    return {
      name: null,
      description: this.name,
      frequency: 0,
      queue: "default",
      middleware: [],
      plugins: [],
      pluginOptions: {},
      reEnqueuePeriodicTaskIfException: true
    };
  }

  validate() {
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
