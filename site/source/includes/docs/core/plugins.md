# Plugins

As of actionhero version `v8.0.0`, you can create and include plugins for you actionhero project.  Plugins are collections of `tasks`, `actions`, `servers`, and `initializers` that are collected as a module.  You can install plugins via NPM or keep them in a local path.

Plugins are loaded after all local actionhero project files, but initializers follow the same priority scheme as all other initializers.

## Including Plugins

`api.config.general.paths.plugin` (loaded from `/config/api.js`) is an array which contains the search path for your plugins.  This will default to `./node_modules`, but you can add a local path to your project.  Once you have the plugin search paths set up, you use `npm run actionhero link -- --name nameOfPlugin` (or `./node_modules/.bin/actionhero link --name nameOfPlugin`, which is equivalent) to create links in your top-level project to the plugin.  This will also copy over any config files from the plugin into your project so you can modify them.  The act of "linking" simply creates a `myPlugin.link` file in each component of your top-level project (actions, tasks, etc) which tells actionhero to load up files at boot from that plugin.  

When you want to overwrite the config files when the plugin is linked, add the parameter `overwriteConfig` to the `link` call (e.g. `npm run actionhero link --name nameOfPlugin --overwriteConfig`)

You can delete the linked files with the "unlink" method using  `npm run actionhero unlink --name nameOfPlugin`.
Remember that you have to delete the config files of unlinked plugins manually!
If your plugin was installed via NPM, also be sure to remove it from your package.json or uninstall it with `npm uninstall --save`

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

This structure will allow elements to be loaded into actionhero (we search `/actions` for actions, `/tasks` for tasks, etc)

When developing your plugin locally, you can load it into an existing actionhero project to test it out.

First, add the path your plugin is in to `api.config.general.paths.plugin`.  If your actionhero app is in `/var/ah/actionhero` and your plugin is in `/var/ah/my_plugin`, add `/var/ah` to `api.config.general.paths.plugin`

**Please use the npm naming convention `ah-(name)-plugin` when uploading your plugin to npm**

## Changes in V13.0.0  

The plugin system was significantly changes in Actionhero version `13.0.0`.  Older plugins will not work.  
- `config/plugins.js` has been removed in favor of the linking system
- Config files from within plugins are no longer sourced
- There should be no more postinstall scripts needed, and as such, none are executed
- Be sure that your plugin is OS-independant. Use path.sep for file path separators and things like that. Use relative paths for everything in your plugin.

## Plugin methods

When creating plugins, you may find yourself wanting to do things which could normally be accomplished easily with a "top level" actionhero project, but might be difficult from within the `node_modules` folder.  Here are some helpers:

### Routes:

- `api.routes.registerRoute(method, path, action, apiVersion, matchTrailingPathParts)`
  - Add a route to the system.  

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
