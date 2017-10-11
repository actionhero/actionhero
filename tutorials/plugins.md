## Overview

As of ActionHero version `v8.0.0`, you can create and include plugins for you ActionHero project. Plugins are collections of `tasks`, `actions`, `servers`, and `initializers` that are collected as a module. You can install plugins via NPM or keep them in a local path.

Plugins are loaded after all local ActionHero project files, but initializers follow the same priority scheme as all other initializers.

## Creating

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

This structure will allow elements to be loaded into ActionHero (we search `/actions` for actions, `/tasks` for tasks, etc)

When developing your plugin locally, you can load it into an existing ActionHero project to test it out.

First, add the path your plugin is in to `api.config.general.paths.plugin`. If your ActionHero app is in `/var/ah/actionhero` and your plugin is in `/var/ah/my_plugin`, add `/var/ah` to `api.config.general.paths.plugin`

**Please use the npm naming convention `ah-(name)-plugin` when uploading your plugin to npm**

## Methods

When creating plugins, you may find yourself wanting to do things which could normally be accomplished easily with a "top level" ActionHero project, but might be difficult from within the `node_modules` folder. Here are some helpers:

### Routes:

*   `api.routes.registerRoute(method, path, action, apiVersion, matchTrailingPathParts)`
    *   Add a route to the system.

## Examples

[You can view a sample plugin here](https://github.com/actionhero/ah-sample-plugin)

## Published

You can view a list of plugins maintained by [@l0oky](https://github.com/l0oky) via [![Awesome](https://cdn.rawgit.com/sindresorhus/awesome/d7305f38d29fed78fa85652e3a63e154dd8e8829/media/badge.svg)](https://github.com/l0oky/awesome-actionhero)