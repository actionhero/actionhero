import { config } from "../..";

/**
 * Used by generator functions running from your `dist`, it replaces the path with your `src`
 * Relies on api.config.general.paths
 */
export function replaceDistWithSrc(f: string) {
  return f.replace(
    config.get<string>("general", "paths", "dist"),
    config.get<string>("general", "paths", "src")
  );
}
