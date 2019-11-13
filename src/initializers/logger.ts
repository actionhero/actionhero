import * as winston from "winston";
import { api, Initializer } from "../index";

export class Logger extends Initializer {
  constructor() {
    super();
    this.name = "logger";
    this.loadPriority = 100;
  }

  async initialize() {
    api.config.general.paths.log.forEach(p => {
      try {
        api.utils.createDirSafely(p);
      } catch (error) {
        if (error.code !== "EEXIST") {
          throw error;
        }
      }
    });

    api.loggers = api.config.logger.loggers.map(loggerBuilder => {
      const resolvedLogger = loggerBuilder(api);
      return winston.createLogger(resolvedLogger);
    });

    /**
     * Log a message, with optional metadata.  The message can be logged to a number of locations (stdio, files, etc) as configured via config/logger.js
     * The default log levels are: `0=debug` `1=info` `2=notice` `3=warning` `4=error` `5=crit` `6=alert` `7=emerg`
     * Learn more at https://github.com/winstonjs/winston
     *
     * the most basic use.  Will assume 'info' as the severity: `api.log('hello')`
     * custom severity: `api.log('OH NO!', 'warning')`
     * custom severity with a metadata object: `api.log('OH NO, something went wrong', 'warning', { error: new Error('things are busted') })`
     */
    api.log = (message: string, severity: string = "info", data: any) => {
      api.loggers.map(logger => {
        if (logger.levels[severity] === undefined) {
          severity = "info";
        }

        const args = [severity, message];

        if (data !== null && data !== undefined) {
          args.push(data);
        }

        return logger.log.apply(logger, args);
      });
    };
  }
}
