let api

module.exports = class Action {
  /**
   * Create a new ActionHero Action. The required properties of an action. These can be defined statically (this.name) or as methods which return a value.
   *
   * @class ActionHero.Action
   *
   * @property {string}  name                   - The name of the Action.
   * @property {string}  description            - The description of the Action (default this.name).
   * @property {Number}  version                - The version of this Action (default: 1).
   * @property {Object}  outputExample          - An example response payload  (default: {}).
   * @property {Object}  inputs                 - The inputs of the Action (default: {}).
   * @property {Array}   middleware             - The Middleware specifit to this Action (default: []).  Middleware is descibed by the string names of the middleware.
   * @property {Array}   blockedConnectionTypes - Are there connections from any servers which cannot use this Action (default: [])?
   * @property {string}  logLevel               - Under what level should connections to this Action be logged (default 'info')?
   * @property {Boolean} matchExtensionMimeType - If this Action is responding to a `web` request, and that request has a file extension like *.jpg, should ActionHero set the response headers to match that extension (default: true)?
   * @property {Boolean} toDocument             - Should this Action appear in api.documenation.documenation? (default: true)?
   *
   * @tutorial actions
   * @example
const {Action} = require('actionhero')

module.exports = class RandomNumber extends Action {
 constructor () {
   super()
   this.name = 'randomNumber'
   this.description = 'I am an API method which will generate a random number'
   this.outputExample = {randomNumber: 0.1234}
 }

 async run ({response}) {
   response.randomNumber = Math.random()
 }
}
   */
  constructor () {
    // Only in files required by `index.js` do we need to delay the loading of the API object
    // This is due to cyclical require issues
    api = require('./../index.js').api

    let coreProperties = this.coreProperties()
    for (let key in coreProperties) {
      if (!this[key]) { this[key] = coreProperties[key] }
      if (typeof this[key] === 'function') { this[key] = this[key]() }
    }
  }

  /**
   * @function run
   * @async
   * @memberof ActionHero.Action
   * @param  {Object}  data The data about this connection, response, and params.
   * @description The main "do something" method for this action.  It can be `async`.  Usually the goal of this run method is to set properties on `data.response`.  If error is thrown in this method, it will be logged, caught, and appended to `data.response.error`
   */

  coreProperties () {
    return {
      name: null,
      version: 1,
      description: this.name,
      outputExample: {},
      inputs: {},
      middleware: [],
      blockedConnectionTypes: [],
      logLevel: 'info',
      matchExtensionMimeType: true,
      toDocument: true
    }
  }

  validate () {
    if (!this.name) { throw new Error('name is required for this action') }
    if (!this.description) { throw new Error(`description is required for the action \`${this.name}\``) }
    if (!this.run || typeof this.run !== 'function') { throw new Error(`action \`${this.name}\` has no run method`) }
    if (api.connections && api.connections.allowedVerbs.indexOf(this.name) >= 0) {
      throw new Error(`action \`${this.name}\` is a reserved verb for connections. choose a new name`)
    }
  }
}
