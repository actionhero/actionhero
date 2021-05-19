import * as winston from "winston";

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
  logger: (config) => {
    const loggers: ActionheroConfigLoggerBuilderArray = [];
    loggers.push(buildConsoleLogger());
    config.general.paths.log.forEach((p) => {
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
  logger: (config) => {
    const loggers: ActionheroConfigLoggerBuilderArray = [];
    loggers.push(buildConsoleLogger("crit"));
    config.general.paths.log.forEach((p) => {
      loggers.push(buildFileLogger(p, "debug", 1));
    });

    return { loggers };
  },
};

// helpers for building the winston loggers

function buildConsoleLogger(level = "info") {
  return function (config) {
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

function stringifyExtraMessagePropertiesForConsole(info) {
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

function buildFileLogger(path, level = "info", maxFiles = undefined) {
  return function (config) {
    const filename = `${path}/${config.process.id}-${config.process.env}.log`;
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
