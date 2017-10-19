module.exports = class Task {
  /**
   * Create a new ActionHero Task. The required properties of an task. These can be defined statically (this.name) or as methods which return a value.
   *
   * @class ActionHero.Task
   *
   * @property {string}  name        - The name of the Task.
   * @property {string}  description - The description of the Task (default this.name).
   * @property {Number}  frequency   - How often to run this Task, in ms.  0 is non-recurring. (default: 0).
   * @property {Array}   middleware  - The Middleware specific to this Task (default: []).  Middleware is descibed by the string names of the middleware.
   * @property {string}  queue       - The default queue to run this Task on (default: 'default').
   *
   * @tutorial tasks
   * @example
'use strict'
const {Task, api} = require('actionhero')

module.exports = class SayHello extends Task {
 constructor () {
   super()
   this.name = 'sayHello'
   this.description = 'I say Hello every minute'
   this.frequency = (60 * 1000)
 }

 async run (data, worker) {
   api.log('Hello!')
 }
}
   */
  constructor () {
    let coreProperties = this.coreProperties()
    for (let key in coreProperties) {
      if (!this[key]) { this[key] = coreProperties[key] }
      if (typeof this[key] === 'function') { this[key] = this[key]() }
    }
  }

  /**
   * The main "do something" method for this task.  It can be `async`.  Anything returned from this metod will be logged.
   * If error is thrown in this method, it will be logged & caught.  Using middleware, you can decide to re-run the task on failure.
   * `this` is a Task instance itself now.
   *
   * @function run
   * @async
   * @memberof ActionHero.Task
   * @param  {Object}  data The data about this instance of the task, specifically params.
   * @param  {Object}  worker Instance of a node-resque worker. You can inspect `worker.job` and set `worker.result` explicitly if your Task does not return a value.
   */

  coreProperties () {
    return {
      name: null,
      description: this.name,
      frequency: 0,
      queue: 'default',
      middleware: []
    }
  }

  validate () {
    if (!this.name) { throw new Error('name is required for this task') }
    if (!this.description) { throw new Error(`description is required for the task \`${this.name}\``) }
    if (!this.queue) { throw new Error(`queue is required for the task \`${this.name}\``) }
    if (this.frequency === null || this.frequency === undefined) { throw new Error(`frequency is required for the task \`${this.name}\``) }
    if (!this.run || typeof this.run !== 'function') { throw new Error(`task \`${this.name}\` has no run method`) }
  }
}
