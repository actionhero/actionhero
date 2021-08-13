import { isPlainObject } from "./isPlainObject";
import { config } from "../..";
import * as dotProp from "dot-prop";

/**
 * Prepares acton params for logging.
 * Hides any sensitive data as defined by `api.config.general.filteredParams`
 * Truncates long strings via `api.config.logger.maxLogStringLength`
 */
export function filterObjectForLogging(params: { [key: string]: any }): {
  [key: string]: any;
} {
  params = Object.assign({}, params);
  const sanitizedParams: { [key: string]: any } = {};

  for (const i in params) {
    if (
      Array.isArray(params[i]) &&
      params[i].length >
        (config.get<{ [key: string]: any }>("logger")?.maxLogArrayLength ?? 10)
    ) {
      params[i] = `${params[i].length} items`;
    }

    if (isPlainObject(params[i])) {
      sanitizedParams[i] = params[i];
    } else if (typeof params[i] === "string") {
      sanitizedParams[i] = params[i].substring(
        0,
        config.get<number>("logger", "maxLogStringLength")
      );
    } else {
      sanitizedParams[i] = params[i];
    }
  }

  const filteredParams = config.get<string[]>("general", "filteredParams");
  filteredParams.forEach((configParam) => {
    if (dotProp.get(params, configParam) !== undefined) {
      dotProp.set(sanitizedParams, configParam, "[FILTERED]");
    }
  });

  return sanitizedParams;
}
