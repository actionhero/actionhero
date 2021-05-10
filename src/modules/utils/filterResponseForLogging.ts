import { isPlainObject } from "./isPlainObject";
import { config } from "../config";
import * as dotProp from "dot-prop";

/**
 * Prepares acton response for logging.
 * Hides any sensitive data as defined by `api.config.general.filteredResponse`
 * Truncates long strings via `api.config.logger.maxLogStringLength`
 */
export function filterResponseForLogging(response: object): {
  [key: string]: any;
} {
  const filteredResponse = {};
  for (const i in response) {
    if (isPlainObject(response[i])) {
      filteredResponse[i] = Object.assign({}, response[i]);
    } else if (typeof response[i] === "string") {
      filteredResponse[i] = response[i].substring(
        0,
        config.logger.maxLogStringLength
      );
    } else if (response[i] instanceof Error) {
      filteredResponse[i] = response[i].message ?? String(response[i]);
    } else {
      filteredResponse[i] = response[i];
    }
  }
  config.general.filteredResponse.forEach((configParam) => {
    if (dotProp.get(response, configParam) !== undefined) {
      dotProp.set(filteredResponse, configParam, "[FILTERED]");
    }
  });
  return filteredResponse;
}
