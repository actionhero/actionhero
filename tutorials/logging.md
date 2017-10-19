![](ops-tools.svg)

## Overview

ActionHero uses the **[Winston logger](https://github.com/flatiron/winston)**. This allows for better, more customizable logging.

## Defaults

```js
// config/logger.js

config.logger = {
  transports: [
    (api) => {
      return new (winston.transports.Console)({
        colorize: true,
        level: "debug",
      });
    },

    (api) => {
      return new (winston.transports.File)({
        filename: './log/' + api.pids.title + '.log',
        level: "info",
        timestamp: true,
      });
    }
  ]
};
```

In your `config/logger.js`, you can customize which `transports` you would like the logger to use. If none are provided, a default logger which only will print to stdout will be used. See winston's documentation for all the logger types, but know that they include console, file, s3, riak, and more.

You can set a transport directly, IE `new (winston.transports.Console)()` or in a function which will be passed the `api` object like the examples above. The benefit of using the function invocation is you will have access to other methods and configuration options (like the title of the process).

## Levels

```js
api.log('hello'); // will use the default, 'info' level
api.log('debug message', 'debug') // will not show up unless you have configured your logger in this NODE_ENV to be debug
api.log('OH NO', 'emerg') // will show up in all logger levels
api.log('the params were', 'info', data.params) // you can log objects too
```

Note that you can set a `level` which indicates which level (and those above it) you wish to log per transport. The log levels are:

*   0=debug
*   1=info
*   2=notice
*   3=warning
*   4=error
*   5=crit
*   6=alert
*   7=emerg

You can customize these via `api.config.logger.levels` and `api.config.logger.colors`. See [Winston's documentation for more information](https://github.com/winstonjs/winston#using-custom-logging-levels)

For example, if you set the logger's level to "notice", you would also see "crit" messages, but not "debug" messages.

To invoke the logger from your code, use: `api.log(message, severity, metadata)`.  Learn more [here](api.html#.log)
