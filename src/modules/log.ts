import * as winston from "winston";
import { config } from "./config";
import { utils } from "./utils";

export let loggers = [];

config.general.paths.log.forEach((p: string) => {
  try {
    utils.fileUtils.createDirSafely(p);
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
});

loggers = config.logger.loggers.map((loggerBuilder: Function) => {
  const resolvedLogger = loggerBuilder(config);
  return winston.createLogger(resolvedLogger);
});

/**
 * Log a message, with optional metadata.  The message can be logged to a number of locations (stdio, files, etc) as configured via config/logger.js
 * The default log levels are: `0=debug` `1=info` `2=notice` `3=warning` `4=error` `5=crit` `6=alert` `7=emerg`
 * Learn more at https://github.com/winstonjs/winston
 *
 * the most basic use.  Will assume 'info' as the severity: `log('hello')`
 * custom severity: `log('OH NO!', 'warning')`
 * custom severity with a metadata object: `log('OH NO, something went wrong', 'warning', { error: new Error('things are busted') })`
 */
export function log(message: string, severity: string = "info", data?: any) {
  loggers.map(logger => {
    if (logger.levels[severity] === undefined) {
      severity = "info";
    }

    const args = [severity, message];

    if (data !== null && data !== undefined) {
      args.push(data);
    }

    return logger.log.apply(logger, args);
  });
}
