import { isPlainObject } from "./isPlainObject";
import { config } from "../config";
import * as dotProp from "dot-prop";

/**
 * Prepares acton params for logging.
 * Hides any sensitive data as defined by `api.config.general.filteredParams`
 * Truncates long strings via `api.config.logger.maxLogStringLength`
 */
export function filterObjectForLogging(params: object): { [key: string]: any } {
  const filteredParams = {};
  for (const i in params) {
    if (isPlainObject(params[i])) {
      filteredParams[i] = Object.assign({}, params[i]);
    } else if (typeof params[i] === "string") {
      filteredParams[i] = params[i].substring(
        0,
        config.logger.maxLogStringLength
      );
    } else {
      filteredParams[i] = params[i];
    }
  }
  config.general.filteredParams.forEach(configParam => {
    if (dotProp.get(params, configParam) !== undefined) {
      dotProp.set(filteredParams, configParam, "[FILTERED]");
    }
  });
  return filteredParams;
}
