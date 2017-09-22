module.exports = class Action {
  /**
   * Create a new ActionHero Action
   * The required properties of an action. These can be defined statically (this.name) or as methods which return a value
   *
   * @class ActionHero.Action
   *
   * @property {string}  name                   - The name of the action.
   * @property {string}  description            - The description of the action (default this.name).
   * @property {number}  version                - The version of this action (default: 1).
   * @property {object}  outputExample          - An example response payload  (default: {}).
   * @property {object}  inputs                 - The inputs of the action (default: {}).
   * @property {array}   middleware             - The Middleware specifit to this action (default: []).  Middleware is descibed by the string names of the middleware.
   * @property {array}   blockedConnectionTypes - Are there connections from any servers which cannot use this action (default: [])?
   * @property {string}  logLevel               - Under what level should connections to this action be logged (default 'info')?
   * @property {boolean} matchExtensionMimeType - If this action is responding to a `web` request, and that request has a file extension like *.jpg, should ActionHero set the response headers to match that extension (default: true)?
   * @property {boolean} toDocument             - Should this action appear in api.documenation.documenation? (default: true)?
   */
  constructor () {
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
   * @param  {object}  api The api object.
   * @param  {object}  data The data about this connection, response, and params.
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

  validate (api) {
    if (!this.name) { throw new Error('name is required for this action') }
    if (!this.description) { throw new Error(`description is required for the action \`${this.name}\``) }
    if (!this.run || typeof this.run !== 'function') { throw new Error(`action \`${this.name}\` has no run method`) }
    if (api.connections && api.connections.allowedVerbs.indexOf(this.name) >= 0) {
      throw new Error(`action \`${this.name}\` is a reserved verb for connections. choose a new name`)
    }
  }
}
