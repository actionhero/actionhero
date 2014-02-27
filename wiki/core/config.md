---
layout: wiki
title: Wiki - Config
---

# Config

## Overview

There are 2 ways to deal with actionHero config: environment files and overrides.  In both cases, actionhero starts by reading the config in `./config/config.js`. Every actionhero node needs a `config.js` file to set things up.  [Here is a documented an example](https://github.com/evantahler/actionhero/blob/master/config/config.js).  

The normal way to deal with configuration changes is to use the files in `/config/environments/{ENV}.js` to have special options for that environment.  actionhero uses the environment standard variable NODE_ENV to determine environment, and defaults to 'development' when one isn't found.  A good way to visualize this to note that by default the web server will return metadata in response JSON, but we change that in the production NODE_ENV and disable it.  This pattern is very similar the Rails and Sails frameworks.  

The other way to modify the config is to pass a "changes" hash to the sever directly at boot.  You can do things like: actionhero.start({configChanges: configChanges}, callback).

The load order of configs is:
- config.js
- ~env.js
- options passed in to boot with `actionhero.start({configChanges: configChanges}, callback)`

## config Changes

A configChanges example:   

{% highlight javascript %}
var actionhero = require("actionhero").actionhero;

// if there is no config.js file in the application's root, then actionhero will load in a collection of default params.  You can overwrite them with params.configChanges
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
{% endhighlight %}

## Boot Options

When launching actionhero you can specify which config file to use with `--config=/path/to/file` or the environment variable `ACTIONHERO_CONFIG`, otherwise `confg.js` will be used from your working directory. 