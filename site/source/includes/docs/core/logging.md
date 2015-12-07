# Logging

## Winston

ActionHero uses the [Winston logger](https://github.com/flatiron/winston).  This allows for better, more customizable logging.  

## Defaults

```javascript
config.logger = {
  transports: [
    function(api){
      return new (winston.transports.Console)({
        colorize: true, 
        level: "debug", 
      });
    },
    function(api){
      return new (winston.transports.File)({
        filename: './log/' + api.pids.title + '.log',
        level: "info",
        timestamp: true,
      });
    }
  ]
};
```

In your `config/logger.js`, you can customize which `transports` you would like the logger to use. If none are provided, a default logger which only will print to stdout will be used.  See winston's documentation for all the logger types, but know that they include console, file, s3, riak, and more.

The default loggers are => 

You can set a transport directly, IE `new (winston.transports.Console)()` or in a function which will be passed the `api` object like the examples above.  The benefit of using the function invocation is you will have access to other methods and configuration options (like the title of the process).

## Levels

```javascript
api.log('hello'); // will use the default, 'info' level
api.log('debug message', 'debug') // will not show up unless you have configured your logger in this NODE_ENV to be debug
api.lot('OH NO', 'emerg') // will show up in all loger levels
api.lot('the params were', 'info', data.params) // you can log objects too
```


Note that you can set a `level` which indicates which level (and those above it) you wish to log per transport.  The log levels are:

- 0=debug
- 1=info
- 2=notice
- 3=warning
- 4=error
- 5=crit
- 6=alert
- 7=emerg

You can customize these via `api.config.logger.levels` and `api.config.logger.colors`.  See [Winston's documenation for more information](https://github.com/winstonjs/winston#using-custom-logging-levels)

For example, if you set the logger's level to "notice", you would also see "crit" messages, but not "debug" messages.

To invoke the logger from your code, use:

### api.log(message, severity, metadata)
- message is a string
- severity is a string, and should match the log-level (IE: 'info' or 'warning')
- the default severity level is 'info'
- (optional) metadata is anything that can be stringified with `JSON.stringify`

## Methods

`api.logger.log` and `api.logger[severity]` also exist which allow you to call and modify the Winston instance directly.

`api.log` will pass your message to all transports.