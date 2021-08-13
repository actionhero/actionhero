import { isPlainObject } from "./isPlainObject";
import { config } from "../..";
import * as dotProp from "dot-prop";

/**
 * Prepares acton response for logging.
 * Hides any sensitive data as defined by `api.config.general.filteredResponse`
 * Truncates long strings via `api.config.logger.maxLogStringLength`
 */
export function filterResponseForLogging(response: { [key: string]: any }): {
  [key: string]: any;
} {
  response = Object.assign({}, response);
  const sanitizedResponse: { [key: string]: any } = {};

  for (const i in response) {
    if (isPlainObject(response[i])) {
      sanitizedResponse[i] = response[i];
    } else if (typeof response[i] === "string") {
      sanitizedResponse[i] = response[i].substring(
        0,
        config.get<number>("logger", "maxLogStringLength")
      );
    } else if (response[i] instanceof Error) {
      sanitizedResponse[i] = response[i].message ?? String(response[i]);
    } else {
      sanitizedResponse[i] = response[i];
    }
  }

  const filteredResponse = config.get<string[]>("general", "filteredResponse");
  filteredResponse.forEach((configParam) => {
    if (dotProp.get(response, configParam) !== undefined) {
      dotProp.set(sanitizedResponse, configParam, "[FILTERED]");
    }
  });

  return sanitizedResponse;
}
