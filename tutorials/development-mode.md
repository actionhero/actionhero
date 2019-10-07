![](ops-tools.svg)

## Overview

**Warning: Don't use this in production!**

To enable development mode simply set `developmentMode: true` in your `config/api.js`.

ActionHero's development mode is a little different than tools like [nodemon](https://github.com/remy/nodemon) in that it tries hard not to restart the server process unless something drastic changes. Changes to actions and tasks can simply replace those already in memory when they are updated on disk. Other changes, like changes to configs or initializers are more severe, and will restart the whole application. If you want to force a full application restart, even for changes to actions and tasks, then set `api.config.developmentModeForceRestart = true`. This can be particularly helpful in case you run into unwanted side effects caused by the in-memory update. Note that `api.config.general.developmentMode` is different from `NODE_ENV`, which by default is "development" (and is logged when ActionHero boots). `NODE_ENV` is used to determine which config settings to use, and has no effect on developmentMode.

## Effects of Development Mode

Development mode, when enabled, will poll for changes in your actions, tasks and initializers, and reload them on the fly.

Changes to actions and tasks will override the existing version in memory. Changes to a configs, initializers and servers will reboot the actionhero process automatically.
You can also force a reboot on change of actions and tasks with `api.config.developmentModeForceRestart` enabled.

*   Development Mode uses `fs.watchFile()` and may not work on all OSs / file systems.
*   New files won't be loaded in, only existing files when the app was booted will be monitored
*   As deleting a file might crash your application, we will not attempt to re-load deleted files
*   If you have changed the `task.frequency` of a periodic task, you will continue to use the old value until the task fires at least once after the change
*   Changing configs, initializers, or servers, will attempt to do a "full" reboot the server rather than just reload that component.

## Watching Custom Files

```js
api.watchFileAndAct(path_to_file, () => {
  api.log('rebooting due to config change: ' + path_to_file, 'info')
  api.commands.restart()
});
```

You can use ActionHero's `api.watchFileAndAct()` method to watch additional files your application may have.  Use this to extend developmentMode when adding new types of files, like database models.

## Debugging

Modern versions of node.js have built-in inspector capabilities.

Run ActionHero with node's `--inspect` flag, ie: `node ./node_modules/.bin/actionhero --inspect start`

More info about new [node inspector](https://nodejs.org/en/docs/inspector)

## REPL

```bash
actionhero console

Running "console" task
2015-11-14 17:48:01 - notice: *** starting actionhero ***
2015-11-14 17:48:01 - warning: running with fakeredis
2015-11-14 17:48:01 - info: actionhero member 10.0.1.15 has joined the cluster
2015-11-14 17:48:01 - notice: pid: 38464
2015-11-14 17:48:01 - notice: server ID: 10.0.1.15
2015-11-14 17:48:01 - info: ensuring the existence of the chatRoom: defaultRoom
2015-11-14 17:48:01 - info: ensuring the existence of the chatRoom: anotherRoom
2015-11-14 17:48:01 - notice: environment: development
2015-11-14 17:48:01 - notice: *** Server Started @ 2015-11-14 17:48:01 ***
[ AH::development ] > api.id
‘10.0.1.15'

[ AH::development ] > Object.keys(api.actions.actions)
[ ‘cacheTest',
‘randomNumber',
‘showDocumentation',
‘sleepTest',
‘status' ]
```

ActionHero has a command-line interface called a REPL! This means you can spin up a new instance of ActionHero and manually call all the methods on the `api` namespace. This combined with the new RPC tools make this a powerful debugging and development tool. Running `actionhero console` will load up a version of ActionHero in your terminal where you have access to the `api` object. This version of the server will `boot`, `initialize`, and `start`, but will skip booting any `servers`.  You will be connected to any databases per your initializers.

The REPL will:

*   source `NODE_ENV` properly to load the config
*   will connect to redis and load any user-defined initializers
*   will load any plugins
*   will **not** boot any servers

If you are familiar with rails, this is very similar to `rails console`
