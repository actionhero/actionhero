import * as winston from "winston";
import { ActionheroConfigInterface } from "..";

const namespace = "logger";

declare module ".." {
  export interface ActionheroConfigInterface {
    [namespace]: ReturnType<(typeof DEFAULT)[typeof namespace]>;
  }
}

/*
The loggers defined here will eventually be available via `import { loggers } from "actionhero"`

You may want to customize how Actionhero sets the log level.  By default, you can use `process.env.LOG_LEVEL` to change each logger's level (default: 'info')

learn more about winston v3 loggers @
 - https://github.com/winstonjs/winston
 - https://github.com/winstonjs/winston/blob/master/docs/transports.md
*/

type ActionheroConfigLoggerBuilderArray = Array<
  (config: ActionheroConfigInterface) => winston.Logger
>;

export const DEFAULT = {
  [namespace]: (config: ActionheroConfigInterface) => {
    const loggers: ActionheroConfigLoggerBuilderArray = [];
    loggers.push(buildConsoleLogger(process.env.LOG_LEVEL));
    config.general.paths.log.forEach((p: string) => {
      loggers.push(buildFileLogger(p, process.env.LOG_LEVEL));
    });

    return {
      loggers,
      maxLogStringLength: 100, // the maximum length of param to log (we will truncate)
      maxLogArrayLength: 10, // the maximum number of items in an array to log before collapsing into one message
    };
  },
};

export const test = {
  [namespace]: (config: ActionheroConfigInterface) => {
    const loggers: ActionheroConfigLoggerBuilderArray = [];
    loggers.push(buildConsoleLogger(process.env.LOG_LEVEL ?? "crit"));
    config.general.paths.log.forEach((path: string) => {
      loggers.push(buildFileLogger(path, "debug", 1));
    });

    return { loggers };
  },
};

// helpers for building the winston loggers

function buildConsoleLogger(level = "info") {
  return function () {
    return winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf((info) => {
          return `${info.timestamp} - ${info.level}: ${
            info.message
          } ${stringifyExtraMessagePropertiesForConsole(info)}`;
        }),
      ),
      level,
      levels: winston.config.syslog.levels,
      transports: [new winston.transports.Console()],
    });
  };
}

function buildFileLogger(path: string, level = "info", maxFiles?: number) {
  return function (config: ActionheroConfigInterface) {
    const filename = `${path}/${config.process.id}-${config.process.env}.log`;
    return winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      level,
      levels: winston.config.syslog.levels,
      transports: [
        new winston.transports.File({
          filename,
          maxFiles,
        }),
      ],
    });
  };
}

function stringifyExtraMessagePropertiesForConsole(
  info: winston.Logform.TransformableInfo,
) {
  const skippedProperties = ["message", "timestamp", "level"];
  let response = "";

  for (const key in info) {
    const value = info[key];
    if (skippedProperties.includes(key)) {
      continue;
    }
    if (value === undefined || value === null || value === "") {
      continue;
    }
    response += `${key}=${value} `;
  }

  return response;
}
