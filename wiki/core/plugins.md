---
layout: wiki
title: Wiki - Plugins
---

# Plugins

As of actionhero version 8.0.0, you can create and include plugins for you actionhero project.  Plugins are collections of `tasks`, `actions`, `servers`, and `initializers` that are collected as a module.  You can install plugins via NPM or keep them in a local path.

Plugins are loaded after all local actionhero project files.

## Including Plugins

`api.config.general.paths.plugin` is an array which contains the search path for your plugins.  This will default to `./node_modules`, but you can add a local path to your project.  Once you have the plugin search paths set up, you use `api.config.general.plugins` to create a list of the plugins to load.  The search paths will then be used to find the named plugins and load in their contents.

## Creating Plugins

To create a plugin, create a project with the following structure:

{% highlight bash %}
/
| - actions
| - tasks
| - servers
| - initializers
| - scripts
| - config
|
| - package.json
{% endhighlight %}

This structure will allow elements to be loaded into actionhero (we search `/actions` for actions, etc)

The `scripts` directory is used to contain any install scripts.  For example, imagine your plugin relies on configuration settings which are expected to be in a `api.config.myPlugin` hash.  Write an example config file in `/config`, and then use a post-install script to copy that into the containing project's `/config` directory.  For example:

{% highlight javascript %}
#!/usr/bin/env node

var fs = require('fs');
var path = require('path');

var localFile   = path.normalize(__dirname + '/../config/ah-sample-plugin.js');
var projectFile = path.normalize(process.cwd() + '/../../config/plugins/ah-sample-plugin.js');

if(!fs.existsSync(projectFile)){
  console.log("copying " + localFile + " to " + projectFile);
  fs.createReadStream(localFile).pipe(fs.createWriteStream(projectFile));
}
{% endhighlight %}

And you would add the following to your `package.json`:

{% highlight javascript %}
"scripts": {
  "postinstall": "scripts/postinstall.js"
}
{% endhighlight %}

When developing your plugin locally, you can load it into an existing actionhero project to test it out.

First, add the path your plugin is in to `api.config.general.paths.plugin`.  If your actionhero app is in `/var/ah/actionhero` and your plugin is in `/var/ah/my_plugin`, add `/var/ah` to `api.config.general.paths.plugin`

Then, in `api.config.general.plugins`, add the name of your plugin, in this case `my_plugin`.  Note that the directory name and the package name in the plugin's `package.json` should match.

**Please use the npm naming convention `ah-(name)-plugin` when uploading your plugin to npm**

## Example Plugin

[You can view a sample plugin here](https://github.com/evantahler/ah-sample-plugin)

---

# Published Plugins

- [ah-airbrake-plugin](https://github.com/evantahler/ah-airbrake-plugin) Airbrake Integration
- [ah-newrelic-plugin](https://github.com/evantahler/ah-newrelic-plugin) NewRelic Integration
- [ah-sequelize-plugin](https://github.com/evantahler/ah-sequelize-plugin) Sequelize Integration for mySQL or Postgres
- [ah-nodemailer-plugin](https://github.com/panjiesw/ah-nodemailer-plugin) Nodemailer Integration
