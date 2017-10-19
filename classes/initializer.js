module.exports = class Initializer {
  /**
   * Create a new ActionHero Initializer. The required properties of an initializer. These can be defined statically (this.name) or as methods which return a value.
   *
   * @class ActionHero.Initializer
   *
   * @property {string}  name          - The name of the Initializer.
   * @property {Number}  loadPriority  - What order should this Initializer load at (Default: 1000, ActionHero core methods are < 1000).
   * @property {Number}  startPriority - What order should this Initializer start at (Default: 1000, ActionHero core methods are < 1000).
   * @property {Number}  stopPriority  - What order should this Initializer stop at (Default: 1000, ActionHero core methods are < 1000).
   *
   * @tutorial initializers
   * @example
const {Initializer, api} = require('actionhero')

module.exports = class MyCLICommand extends Initializer {
  constructor () {
    super()
    this.name = 'connectToDatabase'
    this.loadPriority = 1000
    this.startPriority = 1000
    this.stopPriority = 1000
  }

  async initialize () {
    api.connectToDatabase = {}
  }

  async start () {
    // connect
  }
  async stop () {
    // disconnect
  }
}
  */
  constructor (defaults) {
    this.name = null
    this.loadPriority = 1000
    this.startPriority = 1000
    this.stopPriority = 1000
  }

  /**
   * @function initialize
   * @async
   * @memberof ActionHero.Initializer
   * @description Method run as part of the `initialize` lifecycle of your server.  Ususally sets api['YourNamespace']
   */

  /**
   * @function start
   * @async
   * @memberof ActionHero.Initializer
   * @description Method run as part of the `start` lifecycle of your server.  Ususally connects to remote servers or processes.
   */

  /**
   * @function stop
   * @async
   * @memberof ActionHero.Initializer
   * @description Method run as part of the `initialize` lifecycle of your server.  Ususally disconnects from remote servers or processes.
   */

  validate () {
    if (!this.name) { throw new Error('name is required for this initializer') }

    [
      'loadPriority',
      'startPriority',
      'stopPriority'
    ].forEach((priority) => {
      if (!this[priority] || typeof this[priority] !== 'number' || this[priority] < 0) {
        throw new Error(`${priority} is a required property for the initializer \`${this.name}\``)
      }
    })
  }
}
