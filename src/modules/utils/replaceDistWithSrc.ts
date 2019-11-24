import { config } from "../config";

/**
 * Used by generator functions running from your `dist`, it replacaes the path with your `src`
 * Relies on api.config.general.paths
 */
export function replaceDistWithSrc(f: string) {
  return f.replace(config.general.paths.dist, config.general.paths.src);
}
