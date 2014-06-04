---
layout: wiki
title: Wiki - Config
---

# Config

## Overview

There are 2 ways to deal with actionHero configuration: config files and overrides.  In both cases, actionhero starts by reading the config in `./config/`.  [Here is a documented example](https://github.com/evantahler/actionhero/blob/master/config/).
 
The normal way to deal with configuration changes is to use the files in `/config/` and to have special options for that environment.  First we load in all settings from the `default` config block, and then we replace those with anything defined in the relevant `environment` section.  actionhero uses the environment standard variable NODE_ENV to determine environment, and defaults to 'development' when one isn't found.  A good way to visualize this is to note that, by default, the web server will return metadata in response JSON, but we change that in the production NODE_ENV and disable it.  This pattern is very similar the Rails and Sails frameworks.  

{% highlight javascript %}

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

{% endhighlight %}

The other way to modify the config is to pass a "changes" hash to the server directly at boot.  You can do things like: actionhero.start({configChanges: configChanges}, callback).

The load order of configs is:
- default values in `/config`
- environment-specific values in `/config`
- options passed in to boot with `actionhero.start({configChanges: configChanges}, callback)`

When building config files of your own, note that an `exports.default` is always required, and any environment overrides are optional.  What is exported is a hash which eventually resolves a synchronous function which accepts the `api` variable.

## config Changes

A configChanges example:   

{% highlight javascript %}
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
{% endhighlight %}

## Boot Options

When launching actionhero you can specify which config directory to use with `--config=/path/to/file` or the environment variable `ACTIONHERO_CONFIG`, otherwise `/config/` will be used from your working directory. 
