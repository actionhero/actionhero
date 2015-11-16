# Plugins

As of actionhero version `v8.0.0`, you can create and include plugins for you actionhero project.  Plugins are collections of `tasks`, `actions`, `servers`, and `initializers` that are collected as a module.  You can install plugins via NPM or keep them in a local path.

Plugins are loaded after all local actionhero project files, but initializers follow the same priority scheme as all other initializers.

## Including Plugins

`api.config.general.paths.plugin` (loaded from `/config/api.js`) is an array which contains the search path for your plugins.  This will default to `./node_modules`, but you can add a local path to your project.  Once you have the plugin search paths set up, you use `api.config.general.plugins` (loaded from `/config/plugins.js`) to create a list of the plugins to load.  The search paths will then be used to find the named plugins and load in their contents.

## Creating Plugins

```bash
/
| - actions
| - tasks
| - servers
| - initializers
| - scripts
| - config
|
| - package.json
```

To create a plugin, create a project with the following structure:

This structure will allow elements to be loaded into actionhero (we search `/actions` for actions, etc)

When developing your plugin locally, you can load it into an existing actionhero project to test it out.

First, add the path your plugin is in to `api.config.general.paths.plugin`.  If your actionhero app is in `/var/ah/actionhero` and your plugin is in `/var/ah/my_plugin`, add `/var/ah` to `api.config.general.paths.plugin`

Then, in `api.config.general.plugins`, add the name of your plugin, in this case `my_plugin`.  Note that the directory name and the package name in the plugin's `package.json` should match.

**Please use the npm naming convention `ah-(name)-plugin` when uploading your plugin to npm**

## Plugin Scripts

```javascript
#!/usr/bin/env node

var fs = require('fs');
var path = require('path');

var localFile   = path.normalize(__dirname + '/../config/ah-sample-plugin.js');
var projectFile = path.normalize(process.cwd() + '/../../config/plugins/ah-sample-plugin.js');

if(!fs.existsSync(projectFile)){
  console.log("copying " + localFile + " to " + projectFile);
  fs.createReadStream(localFile).pipe(fs.createWriteStream(projectFile));
}
```

The `scripts` directory is used to contain any install scripts.  For example, imagine your plugin relies on configuration settings which are expected to be in a `api.config.myPlugin` hash.  Write an example config file in `/config`, and then use a post-install script to copy that into the containing project's `/config` directory.  For example:

And you would add the following to your `package.json`: ` "postinstall": "scripts/postinstall.js"`

## Example Plugin

[You can view a sample plugin here](https://github.com/evantahler/ah-sample-plugin)

## Published Plugins

- [ah-stats-plugin](https://github.com/evantahler/ah-stats-plugin) Stats Integration (redis backed)
- [ah-airbrake-plugin](https://github.com/evantahler/ah-airbrake-plugin) Airbrake Integration
- [ah-newrelic-plugin](https://github.com/evantahler/ah-newrelic-plugin) NewRelic Integration
- [ah-sequelize-plugin](https://github.com/evantahler/ah-sequelize-plugin) Sequelize Integration for mySQL or Postgres
- [ah-nodemailer-plugin](https://github.com/panjiesw/ah-nodemailer-plugin) Nodemailer Integration
- [ah-ratelimit-plugin](https://github.com/innerdvations/ah-ratelimit-plugin) Rate Limits
- [ah-autosession-plugin](https://github.com/innerdvations/ah-autosession-plugin) Sessions (based off of redis-sessions)
- [ah-dashboard-plugin](https://github.com/S3bb1/ah-dashboard-plugin) Dashboard for ActionHero
- [ah-jwtauth-plugin](https://github.com/lookaflyingdonkey/ah-jwtauth-plugin) JSON Web Token Authentication
- [ah-mongoose-plugin](https://github.com/lookaflyingdonkey/ah-mongoose-plugin) Mongoose Model Loader
- [ah-xsignature-plugin](https://github.com/lookaflyingdonkey/ah-xsignature-plugin) Content Checksum for Actions
- [ah-swagger-plugin](https://github.com/supamii/ah-swagger-plugin) Swagger UI Documentation
- [ah-mongodb-plugin](https://github.com/eduardogch/ah-mongodb-plugin) MongoDB + Mongoose
- [ah-rethinkdb-plugin](https://github.com/eduardogch/ah-rethinkdb-plugin) RethinkDB + Mongoose
