import * as winston from "winston";
import { config } from "..";
import { utils } from "./utils";

// exported as `import { loggers } from "actionhero"`
export let loggers: winston.Logger[] = [];

config.get<string[]>("general", "paths", "log").forEach((p: string) => {
  try {
    utils.fileUtils.createDirSafely(p);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
});

loggers = config.get<Function[]>("logger", "loggers").map((loggerBuilder) => {
  const resolvedLogger = loggerBuilder(config);
  return winston.createLogger(resolvedLogger);
});

export type ActionHeroLogLevel =
  | "emerg"
  | "alert"
  | "crit"
  | "error"
  | "warning"
  | "notice"
  | "info"
  | "debug";

/**
 * Log a message, with optional metadata.  The message can be logged to a number of locations (stdio, files, etc) as configured via config/logger.js
 *
 * The most basic use.  Will assume 'info' as the severity: `log('hello')`
 * Custom severity: `log('OH NO!', 'warning')`
 * Custom severity with a metadata object: `log('OH NO, something went wrong', 'warning', { error: new Error('things are busted') })`
 *
 * The default log levels are: `emerg: 0, alert: 1, crit: 2,  error: 3,  warning: 4,  notice: 5, info: 6, debug: 7`.
 * Logging levels in winston conform to the severity ordering specified by RFC5424: severity of all levels is assumed to be numerically ascending from most important to least important.
 * Learn more at https://github.com/winstonjs/winston
 */
export function log(
  message: string,
  severity: ActionHeroLogLevel = "info",
  data?: any
) {
  loggers.map((logger) => {
    if (logger.levels[severity] === undefined) severity = "info";

    const args = [severity, message];
    if (data !== null && data !== undefined) args.push(data);

    return logger.log.apply(logger, args);
  });
}
