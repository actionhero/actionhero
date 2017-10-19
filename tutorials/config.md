![](video-game-servers.svg)

## Overview

There are 2 ways to manage actionHero configuration: configuration files and overrides. In both cases, ActionHero starts by reading the config in `./config/`. [Here is what config files for a new ActionHero project look like](https://github.com/actionhero/actionhero/blob/master/config/).

The normal way to deal with configuration changes is to use the files in `/config/` and to have changed options for each environment, based on NODE_ENV. First we load in all settings from the `default` config block, and then we replace those with anything defined in the relevant `environment` section. ActionHero uses the standard node environment variable `NODE_ENV` to determine environment, and defaults to ‘development' when one isn't found. This pattern is very similar the Rails and Sails frameworks. A good way to visualize this is to note that, by default, the server will return metadata in response JSON, but we change that in the production NODE_ENV and disable it.

```js
exports.default = {
  general: (api) => {
    return {
      //...
      developmentMode: true
      //...
    }
  }
}

exports.production = {
  general: (api) => {
    return {
      developmentMode: false
    }
  }
}
```

The other way to modify the config is to pass a "changes" hash to the server directly at boot. You can do things like: `actionhero.start({configChanges: configChanges})`.  This should only bse used in special cases or [tests](tutorial-testing.html).

The priority order of configs is:

1.  options passed in to boot with `actionhero.start({configChanges: configChanges})`
2.  environment-specific values in `/config`
3.  default values in `/config`

When building config files of your own, note that an `exports.default` is always required, and any environment overrides are optional. What is exported is a hash which eventually resolves a synchronous function which accepts the `api` variable.

## Config Changes

A configChanges example:

```js
const ActionHero = require("actionhero")
const actionhero = new ActionHero.Process()

const configChanges = {
  general: {
    developmentMode: true
  }
}

// start the server!
await actionhero.start({configChanges})
api.log("Boot Successful!")
```

## Boot Options to find the Config Directory

When launching ActionHero you can specify which config directory to use with `--config '/path/to/dir'` or the environment variable `ACTIONHERO_CONFIG`, otherwise `./config/` will be used from your working directory.

The priority of arguments is:

1.  Use the project's `./config` folder, if it exists.
2.  `actionhero --config=PATH1 --config=PATH2 --config=PATH3,PATH4`
3.  `ACTIONHERO_CONFIG=PATH1,PATH2 npm start`

Note that if `--config` or `ACTIONHERO_CONFIG` are used, they _overwrite_ the use of the default `/config` folder. If you wish to use both, you need to re-specify "config", e.g. `--config=config,local-config`. Also, note that specifying multiple `--config` options on the command line does exactly the same thing as using one parameter with comma separators, however the environment variable method only supports the comma-delimited syntax.
