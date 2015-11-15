# Config

## Overview

There are 2 ways to manage actionHero configuration: config files and overrides.  In both cases, actionhero starts by reading the config in `./config/`.  [Here is a documented example](https://github.com/evantahler/actionhero/blob/master/config/).
 
The normal way to deal with configuration changes is to use the files in `/config/` and to have special options for each environment.  First we load in all settings from the `default` config block, and then we replace those with anything defined in the relevant `environment` section.  actionhero uses the standard node environment variable `NODE_ENV` to determine environment, and defaults to 'development' when one isn't found.  This pattern is very similar the Rails and Sails frameworks.  A good way to visualize this is to note that, by default, the web server will return metadata in response JSON, but we change that in the production NODE_ENV and disable it.

```javascript

exports.default = { 
  general: function(api){
    return {  
      //...
      developmentMode: true
      //...
    }
  }
}

exports.production = { 
  general: function(api){
    return {  
      developmentMode: false
    }
  }
}

```

The other way to modify the config is to pass a "changes" hash to the server directly at boot.  You can do things like: `actionhero.start({configChanges: configChanges}, callback)`.

The priority order of configs is:

1. options passed in to boot with `actionhero.start({configChanges: configChanges}, callback)`
2. environment-specific values in `/config`
3. default values in `/config`
4. default values of undifined settings from a plugin
5. default values of undifined settings from actionhero's core

When building config files of your own, note that an `exports.default` is always required, and any environment overrides are optional.  What is exported is a hash which eventually resolves a synchronous function which accepts the `api` variable.

## config Changes

A configChanges example:   

```javascript
var actionhero = require("actionhero").actionhero;

var params = {};
params.configChanges = {
  general: {
    developmentMode: true
  }
}

// start the server!
actionhero.start(params, function(err, api){
  api.log("Boot Successful!");
});
```

## Boot Options

When launching actionhero you can specify which config directory to use with `--config=/path/to/dir` or the environment variable `ACTIONHERO_CONFIG`, otherwise `/config/` will be used from your working directory. 

The priority of arguments is:

1. Use the project 'config' folder, if it exists.
2. "actionhero --config=PATH1 --config=PATH2 --config=PATH3,PATH4"
3. "ACTIONHERO_CONFIG=PATH1,PATH2 npm start"

Note that if `--config` or `ACTIONHERO_CONFIG` are used, they _overwrite_ the use of the default `/config` folder. If you wish to use both, you need to re-specify "config", e.g. `--config=config,local-config`. Also, note that specifying multiple `--config` options on the command line does exactly the same thing as using one parameter with comma separators, however the environment variable method only supports the comma-delimited syntax.
