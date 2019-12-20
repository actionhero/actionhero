import { Inputs } from "./inputs";
import { ActionProcessor } from "./actionProcessor";
import { api } from "../index";

/**
 * Create a new ActionHero Action. The required properties of an action. These can be defined statically (this.name) or as methods which return a value.
 *```js
 * const { Action } = require('actionhero')
 * module.exports = class RandomNumber extends Action {
 *  constructor () {
 *    super()
 *    this.name = 'randomNumber'
 *    this.description = 'I am an API method which will generate a random number'
 *    this.outputExample = { randomNumber: 0.1234 }
 *  }
 *  async run ({ response }) {
 *    response.randomNumber = Math.random()
 *  }
 *}
 *```
 */
export abstract class Action {
  /**The name of the Action*/
  name: string;
  /**The description of the Action (default this.name)*/
  description: string;
  /**The version of this Action (default: 1) */
  version: number | string;
  //*An example response payload  (default: {})
  outputExample: object;
  /**The inputs of the Action (default: {}) */
  inputs: Inputs;
  /**The Middleware specific to this Action (default: []).  Middleware is described by the string names of the middleware. */
  middleware: Array<string>;
  /**Are there connections from any servers which cannot use this Action (default: [])? */
  blockedConnectionTypes: Array<string>;
  /**Under what level should connections to this Action be logged (default 'info')? */
  logLevel: string;
  /**If this Action is responding to a `web` request, and that request has a file extension like *.jpg, should ActionHero set the response headers to match that extension (default: true)? */
  matchExtensionMimeType: boolean;
  /**Should this Action appear in api.documentation.documentation? (default: true)? */
  toDocument: boolean;

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
   * The main "do something" method for this action.  It can be `async`.  Usually the goal of this run method is to set properties on `data.response`.  If error is thrown in this method, it will be logged, caught, and appended to `data.response.error`
   * @param data The data about this connection, response, and params.
   */
  abstract async run(data: ActionProcessor): Promise<void>;

  private defaults() {
    return {
      name: null,
      version: 1,
      description: this.name,
      outputExample: {},
      inputs: {},
      middleware: [],
      blockedConnectionTypes: [],
      logLevel: "info",
      matchExtensionMimeType: true,
      toDocument: true
    };
  }

  validate() {
    if (!this.name) {
      throw new Error("name is required for this action");
    }
    if (!this.description) {
      throw new Error(
        `description is required for the action \`${this.name}\``
      );
    }
    if (!this.run || typeof this.run !== "function") {
      throw new Error(`action \`${this.name}\` has no run method`);
    }
    if (
      api.connections &&
      api.connections.allowedVerbs.indexOf(this.name) >= 0
    ) {
      throw new Error(
        `action \`${this.name}\` is a reserved verb for connections. choose a new name`
      );
    }
  }
}
