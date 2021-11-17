import { api } from "../index";
import type { ActionheroLogLevel } from "../modules/log";
import { ActionProcessor } from "./actionProcessor";
import { connectionVerbs } from "./connection";
import { Inputs } from "./inputs";

/**
 * Create a new Actionhero Action. The required properties of an action. These can be defined statically (this.name) or as methods which return a value.
 *```js
 * import { Action } from "actionhero";
 *
 * export default class RandomNumber extends Action {
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
  version?: number | string;
  //*An example response payload  (default: {})
  outputExample?: object;
  /**The inputs of the Action (default: {}) */
  inputs?: Inputs;
  /**The Middleware specific to this Action (default: []).  Middleware is described by the string names of the middleware. */
  middleware?: Array<string>;
  /**Are there connections from any servers which cannot use this Action (default: [])? */
  blockedConnectionTypes?: Array<string>;
  /**Under what level should connections to this Action be logged (default 'info')? */
  logLevel?: ActionheroLogLevel;
  /**If this Action is responding to a `web` request, and that request has a file extension like *.jpg, should Actionhero set the response headers to match that extension (default: true)? */
  matchExtensionMimeType?: boolean;
  /**Should this Action appear in api.documentation.documentation? (default: true)? */
  toDocument?: boolean;

  constructor() {
    this.version = this.version ?? 1;
    this.description = this.description ?? this.name;
    this.inputs = this.inputs ?? {};
    this.outputExample = this.outputExample ?? {};
    this.middleware = this.middleware ?? [];
    this.blockedConnectionTypes = this.blockedConnectionTypes ?? [];
    this.logLevel = this.logLevel ?? "info";
    this.toDocument = this.toDocument ?? true;
    this.matchExtensionMimeType = this.matchExtensionMimeType ?? true;
  }

  /**
   * The main "do something" method for this action.  It can be `async`.  Usually the goal of this run method is to return the data that you want to be sent to API consumers.  If error is thrown in this method, it will be logged, caught, and returned to the client as `error`
   * @param data The data about this connection, response, and params.
   */
  abstract run(
    data: Partial<ActionProcessor<Action>>
  ): Promise<ActionResponse | void>;

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
      ([...connectionVerbs] as string[]).includes(this.name)
    ) {
      throw new Error(
        `action \`${this.name}\` is a reserved verb for connections. choose a new name`
      );
    }

    Object.keys(this.inputs).forEach((input) => {
      if (api.params.globalSafeParams.includes(input)) {
        throw new Error(
          `input \`${input}\` in action \`${this.name}\` is a reserved param`
        );
      }
    });
  }
}

export type ActionResponse = { [key: string]: any } | null | void;
