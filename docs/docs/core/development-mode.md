---
layout: docs
title: Documentation - Development Mode
---

# REPL

actionhero now has a REPL (`v9.0.0`)! This means you can 'connect' to a running instance of actionhero and manually call all the methods on the `api` namespace.  This combined with the new RPC tools make this a powerful debugging and development tool.  Running `grunt console` will load up a version of action hero in your terminal where you have access to the `api` object.  This version of the server will `boot`, `initialize`, and `start`, but will skip booting any `servers`.  

The REPL will:

- source `NODE_ENV` properly to load the config
- will connect to redis and load any user-defined initializers
- will load any plugins
- will **not** boot any servers

If you are familiar with rails, this is very similar to `rails console`

<img src="https://cloud.githubusercontent.com/assets/303226/2953485/4db6cbe2-da5b-11e3-96de-26fe4931d9af.png">

# Development Mode
**Don't use this in production!**

## About

actionhero's development mode is a little different than tools like [nodemon](https://github.com/remy/nodemon) in that it tries hard not to restart the server process. Changes to routes, tasks, and actions can simply replace those in memory when they are updated on disk. Other changes, like changes to `api.config` or initializers are more severe, and will restart the whole application (much like nodemon).

To enable development mode simply set `developmentMode: true` in your `config/api.js`.

{% highlight javascript%}
config.general = {
  developmentMode: true
}
{% endhighlight %}

## Effects of Development Mode

Development mode, when enabled, will poll for changes in your actions, tasks and initializers, and reload them on the fly.

- this uses fs.watchFile() and will not work on all OSs / file systems.
- new files won't be loaded in, only existing files when the app was booted will be monitored
- as deleting a file might crash your application, we will not attempt to re-load deleted files
- if you have changed the `task.frequency` of a periodic task, you will continue to use the old value until the task fires at least once after the change 
- changing `api.config`, initializers, or servers, will attempt to do a "full" reboot the server rather than just reload that component.

## Watching custom files

You can use actionhero's `watchFileAndAct()` method to watch additional files your application may have:

{% highlight javascript %}
api.watchFileAndAct(path_to_file, function(){
  api.log('rebooting due to config change: ' + path_to_file, 'info');
  api.commands.restart.call(api._self);
});
{% endhighlight %}

# Debugging

You can use the awesome [node-inspector](https://github.com/dannycoates/node-inspector) project to help you debug your actionhero application within the familar Chrome Browser's developer tools.

{% highlight javascript %}
"dependencies": {
  "actionhero": "x",
  "node-inspector": "x"
},
{% endhighlight %}

Be sure to run actionhero with node's `--debug` flag

{% highlight bash %}
node --debug ./node_modules/.bin/actionhero start
{% endhighlight %}

Start up node-inspector (both node-inspector and actionhero have the same default port, so you will need to change one of them)

{% highlight bash %}
./node_modules/.bin/node-inspector --web-port=1234
{% endhighlight %}

That's it! Now you can visit `http://0.0.0.0:1234/debug?port=5858` and start debugging.  Remember that the way node-debugger works has you first set a breakpoint in the file view, and then you can use the console to inspect various objects.  IE: I put a breakpoint in the default `status` action in the `run` method:

{% highlight bash %}
`api.bootTime`
- 1372739939789
{% endhighlight %}