import { isPlainObject } from "./isPlainObject";
import { config } from "../config";
import * as dotProp from "dot-prop";

/**
 * Prepares acton params for logging.
 * Hides any sensitive data as defined by `api.config.general.filteredParams`
 * Truncates long strings via `api.config.logger.maxLogStringLength`
 */
export function filterObjectForLogging(params: object): { [key: string]: any } {
  const sanitizedParams = {};

  for (const i in params) {
    if (isPlainObject(params[i])) {
      sanitizedParams[i] = Object.assign({}, params[i]);
    } else if (typeof params[i] === "string") {
      sanitizedParams[i] = params[i].substring(
        0,
        config.logger.maxLogStringLength
      );
    } else {
      sanitizedParams[i] = params[i];
    }
  }

  let filteredParams: string[];
  if (typeof config.general.filteredParams === "function") {
    filteredParams = config.general.filteredParams();
  } else {
    filteredParams = config.general.filteredParams;
  }

  filteredParams.forEach((configParam) => {
    if (dotProp.get(params, configParam) !== undefined) {
      dotProp.set(sanitizedParams, configParam, "[FILTERED]");
    }
  });

  return sanitizedParams;
}
