const cluster = require("cluster");
const winston = require("winston");

// learn more about winston v3 loggers @
// - https://github.com/winstonjs/winston
// - https://github.com/winstonjs/winston/blob/master/docs/transports.md

function buildConsoleLogger(level = "info") {
  return function(config) {
    return winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(info => {
          return `${config.process.id} @ ${info.timestamp} - ${info.level}: ${
            info.message
          } ${stringifyExtraMessagePropertiesForConsole(info)}`;
        })
      ),
      level,
      levels: winston.config.syslog.levels,
      transports: [new winston.transports.Console()]
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

function buildFileLogger(
  path,
  level = "info",
  maxFiles = undefined,
  maxSize = 20480
) {
  return function(config) {
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
          maxSize,
          maxFiles
        })
      ]
    });
  };
}

export const DEFAULT = {
  logger: config => {
    const loggers = [];

    if (cluster.isMaster) {
      loggers.push(buildConsoleLogger());
    }

    config.general.paths.log.forEach(p => {
      loggers.push(buildFileLogger(p));
    });

    return {
      loggers,

      // the maximum length of param to log (we will truncate)
      maxLogStringLength: 100
    };
  }
};

export const test = {
  logger: config => {
    const loggers = [];

    config.general.paths.log.forEach(p => {
      loggers.push(buildFileLogger(p, "debug", 1));
    });

    return {
      loggers
    };
  }
};
