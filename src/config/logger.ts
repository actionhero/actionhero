import * as winston from "winston";
import { config } from "../";
import { ActionHeroLogLevel } from "../modules/log";

/*
The loggers defined here will eventually be available via `import { loggers } from "actionhero"`

learn more about winston v3 loggers @
 - https://github.com/winstonjs/winston
 - https://github.com/winstonjs/winston/blob/master/docs/transports.md
*/

type ActionheroConfigLoggerBuilderArray = Array<
  (config: any) => winston.Logger
>;

export const DEFAULT = {
  logger: () => {
    const loggers: ActionheroConfigLoggerBuilderArray = [];
    loggers.push(buildConsoleLogger());
    config.get<string[]>("general", "paths", "log").forEach((p: string) => {
      loggers.push(buildFileLogger(p));
    });

    return {
      loggers,
      maxLogStringLength: 100, // the maximum length of param to log (we will truncate)
      maxLogArrayLength: 10, // the maximum number of items in an array to log before collapsing into one message
    };
  },
};

export const test = {
  logger: () => {
    const loggers: ActionheroConfigLoggerBuilderArray = [];
    loggers.push(buildConsoleLogger("crit"));
    config.get<string[]>("general", "paths", "log").forEach((p: string) => {
      loggers.push(buildFileLogger(p, "debug", 1));
    });

    return { loggers };
  },
};

// helpers for building the winston loggers

function buildConsoleLogger(level: ActionHeroLogLevel = "info") {
  return function () {
    return winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf((info) => {
          return `${info.timestamp} - ${info.level}: ${
            info.message
          } ${stringifyExtraMessagePropertiesForConsole(info)}`;
        })
      ),
      level,
      levels: winston.config.syslog.levels,
      transports: [new winston.transports.Console()],
    });
  };
}

function stringifyExtraMessagePropertiesForConsole(info: {
  [key: string]: any;
}) {
  const skippedProperties = ["message", "timestamp", "level"];
  let response = "";

  for (const [key, value] of Object.entries(info)) {
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

function buildFileLogger(
  path: string,
  level: ActionHeroLogLevel = "info",
  maxFiles?: number
) {
  return function () {
    const filename = `${path}/${config.get<string>(
      "process",
      "id"
    )}-${config.get<string>("process", "env")}.log`;
    return winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
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
