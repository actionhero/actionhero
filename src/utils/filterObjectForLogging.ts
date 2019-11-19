import { isPlainObject } from "./isPlainObject";

/**
 * Prepares acton params for logging.
 * Hides any sensitieve data as defined by `api.config.general.filteredParams`
 * Truncates long strings via `api.config.logger.maxLogStringLength`
 */
export function filterObjectForLogging(params: object): object {
  const filteredParams = {};
  for (const i in params) {
    if (isPlainObject(params[i])) {
      filteredParams[i] = Object.assign({}, params[i]);
    } else if (typeof params[i] === "string") {
      filteredParams[i] = params[i].substring(
        0,
        api.config.logger.maxLogStringLength
      );
    } else {
      filteredParams[i] = params[i];
    }
  }
  api.config.general.filteredParams.forEach(configParam => {
    if (api.utils.dotProp.get(params, configParam) !== undefined) {
      api.utils.dotProp.set(filteredParams, configParam, "[FILTERED]");
    }
  });
  return filteredParams;
}
