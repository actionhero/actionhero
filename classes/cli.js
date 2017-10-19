module.exports = class CLI {
  /**
   * Create a new ActionHero CLI Command. The required properties of an CLI command. These can be defined statically (this.name) or as methods which return a value.
   *
   * @class ActionHero.CLI
   *
   * @property {string}  name        - The name of the CLI command.
   * @property {string}  description - The description of the CLI command (default this.name).
   * @property {string}  example     - An example of how to run this CLI command.
   * @property {Object}  inputs      - The inputs of the CLI command (default: {}).
   *
   * @tutorial cli
   * @example
const {CLI, api} = require('actionhero')

module.exports = class MyCLICommand extends CLI {
  constructor () {
    super()
    this.name = 'backup redis'
    this.description = 'I save the contents of redis to a file'
    this.example = 'actionhero backup redis --file=/path/to/file'
    this.inputs = {
      file: {required: true}
    }
  }

  async run ({params}) {
    await api.cache.dumpWrite(params.file)
    return true
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
   * The main "do something" method for this CLI command.  It is an `async` method.
   * If error is thrown in this method, it will be logged to STDERR, and the process will terminate with a non-0 exit code.
   *
   * @function run
   * @async
   * @memberof ActionHero.CLI
   * @param  {Object}  data The data about this instance of the CLI run, specifically params.
   * @return {Promise<Boolean>} The return value of `run` is `toShutdown` (boolean).  If you return true, the CLI process will exit if when the method returns, false will keep running.
   */

  coreProperties () {
    return {
      name: null,
      description: this.name,
      example: '',
      inputs: {}
    }
  }

  validate () {
    if (!this.name) { throw new Error('name is required for this cli command') }
    if (!this.description) { throw new Error(`description is required for the cli commend \`${this.name}\``) }
    if (!this.run || typeof this.run !== 'function') { throw new Error(`cli command \`${this.name}\` has no run method`) }
  }
}
