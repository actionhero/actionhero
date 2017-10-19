![](ops-tools.svg)

## The ActionHero Binary

The suggested method to run your ActionHero server is to use the included `./node_modules/.bin/actionhero` binary. Note that there is no `main.js` or specific start script your project needs. ActionHero handles this for you. Your ActionHero project simply needs to follow the proper directory conventions and it will be bootable.

The help for this binary is as follows:

```
--------------------------------------
ACTIONHERO COMMAND >> help
--------------------------------------
ActionHero - A multi-transport node.js API Server with integrated cluster capabilities and delayed tasks

Binary options:

* actions list
* console
* generate
* generate action
* generate cli
* generate initializer
* generate plugin
* generate server
* generate task
* help
* start
* start cluster
* task enqueue
* version

Descriptions:

* actions list
  description: I will list the actions defined on this server

* console
  description: start an interactive REPL session with the api object in-scope

* generate
  description: will prepare an empty directory with a template ActionHero project

* generate action
  description: generate a new action
  example: actionhero generate action --name=[name] --description=[description]
  inputs:
    [name]
    [description]
      default: an actionhero action

* generate cli
  description: generate a new cli command
  example: actionhero generate cli --name=[name]
  inputs:
    [name]
    [description] (optional)
      default: an actionhero cli command
    [example] (optional)
      default: actionhero command --option=yes

* generate initializer
  description: generate a new initializer
  example: actionhero generate initializer --name=[name] --loadPriority=[p] --startPriority=[p] --stopPriority=[p]
  inputs:
    [name]
    [loadPriority]
      default: 1000
    [startPriority]
      default: 1000
    [stopPriority]
      default: 1000

* generate plugin
  description: generate the structure of a new actionhero plugin in an empty directory
  example: actionhero generate plugin

* generate server
  description: generate a new server
  example: actionhero generate server --name=[name]
  inputs:
    [name]

* generate task
  description: generate a new task
  example: actionhero generate task --name=[name] --description=[description] --scope=[scope] --frequency=[frequency]
  inputs:
    [name]
    [queue]
    [description]
      default: an actionhero task
    [frequency]

* help
  description: get actonhero CLI help; will display this document

* start
  description: start this ActionHero server
  example: actionhero start --config=[/path/to/config] --title=[processTitle] --daemon
  inputs:
    [config] (optional)
      note: path to config.js, defaults to "process.cwd()" + '/' + config.js. You can also use ENV[ACTIONHERO_CONFIG]
    [title] (optional)
      note: process title to use for ActionHero\'s ID, ps, log, and pidFile defaults. Must be unique for each member of the cluster. You can also use ENV[ACTIONHERO_TITLE]. Process renaming does not work on OSX/Windows
    [daemon] (optional)
      note: to fork and run as a new background process defaults to false

* start cluster
  description: start an actionhero cluster
  example: actionhero start cluster --workers=[numWorkers] --workerTitlePrefix=[title] --daemon
  inputs:
    [workers]
      note: number of workers (defaults to # CPUs)
      default: 8
    [title] (optional)
      note: worker title prefix (default 'actionhero-worker-') set `--workerTitlePrefix=hostname`, your app.id would be like your_host_name-#
    [workerTitlePrefix]
      default: actionhero-worker-
    [daemon] (optional)
      note: to fork and run as a new background process defaults to false
    [silent] (optional)

* task enqueue
  description: enqueue a defined task into your actionhero cluster
  example: actionhero task enqueue --name=[taskName] --args=[JSON-formatted args]
  inputs:
    [name]
    [args] (optional)
    [params] (optional)

* version
  description: return the ActionHero version within this project
  ```

## Linking the ActionHero Binary

ActionHero is not designed to function when installed globally.  Do not install ActionHero globally, using `npm install -g`.  Modern versions of NPM (v5+) allow you to also use the `npx` command, ie: `npx actionhero start cluster --workers=2`, which is a simple way to get to the ActionHero binary from the top-level of your project.  Otherwise defining `scripts` referencing actionhero in your `package.json` is the best way to run ActionHero:

```js
{
  "name": "my ActionHero project",
  "scripts": {
    "start" : "actionhero start",
    "help" : "actionhero help",
    "pretest": "standard",
    "test" : "cross-env NODE_ENV=test mocha"
  }
}

```

## Environments and Config

By default, ActionHero will use the settings found in the `exports.default` blocks in `/config/`. However, you can set environment-specific overrides or changes. ActionHero inspects `process.env.NODE_ENV` to load up runtime configuration overrides from `exports.#{env}` blocks in your configuration files. This is the recommended way to have separate settings for staging and production.

The load order of configs is:

* default values in `/config`
* environment-specific values in `/config`
* options passed in to boot with `actionhero.start({configChanges: configChanges})`

You can `{configChanges: {}}` to a new ActionHero.Process' `start` or `initialize` methods.  This can be helpful when creating tests. When using CLI commands, you can also set `process.env.configChanges` or pass `--configChanges` on the command line. In these cases, `configChanges` should be stringified JSON.

```js
// from ./config/namespace.js
exports['default'] = {
  namespace: function (api) {
    return {
      enabled: true,
      safe: false
    }
  }
}

exports.production = {
  namespace: function (api) {
    return {
      safe: true
    }
  }
}
```

In the example above, we are defining `api.config.namespace.enabled` and `api.config.namespace.safe`. In all environments (NODE_ENV) `api.config.namespace.enabled = true` Only in production would `api.config.namespace.safe = true`, it is `false` everywhere else.

## Programatic Use of ActionHero

While **NOT** encouraged, you can always instantiate an ActionHero process yourself. Perhaps you wish to combine ActionHero with an existing project. Here is how! Take note that using these methods will not work for a cluster process, and only a single instance will be started within your project.

```js
const {Process} = require("actionhero")
const actionhero = new Process()

const sleep = (time) => {
  if (!time) { time = 5000 }
  return new Promise((resolve) => {
    setTimeout(resolve, time)
  })
}

const api = await actionhero.start({configChanges})

api.log(" >> Boot Successful!")
await sleep()

api.log(" >> restarting server...")
await actionhero.restart()
api.log(" >> Restarted!")
await sleep()

api.log(" >> stopping server...")
await actionhero.stop()
api.log(" >> Stopped!")
process.exit()
```

Feel free to look at the source of `./node_modules/actionhero/bin/methods/start` to see how the main ActionHero server is implemented for more information.

You can programmatically control an ActionHero server with `actionhero.start(params)`, `actionhero.stop()` and `actionhero.restart()`

From within ActionHero itself (actions, initializers, etc), you can use `api.commands.start`, `api.commands.stop`, and `api.commands.restart` to control the server.

## Signals

```bash
> npx actionhero start cluster --workers=2
info: actionhero >> start cluster
notice:  - STARTING CLUSTER -
notice: pid: 41382
info: starting worker #1
info: worker 41383 (#1) has spawned
info: Worker #1 [41383]: starting
info: Worker #1 [41383]: started
info: starting worker #2
info: worker 41384 (#2) has spawned
info: Worker #2 [41384]: starting
info: Worker #2 [41384]: started

# A new terminal
kill -s TTIN \`cat pids/cluster_pidfile\`

info: worker 41632 (#3) has spawned
info: Worker #3 [41632]: starting
info: Worker #3 [41632]: started

# A new terminal
kill -s KILL \`cat pids/cluster_pidfile\`

warning: Cluster manager quitting
info: Stopping each worker...
info: Worker #1 [41901]: stopping
info: Worker #2 [41904]: stopping
info: Worker #3 [41906]: stopping
info: Worker #3 [41906]: stopped
info: Worker #2 [41904]: stopped
info: Worker #1 [41901]: stopped
alert: worker 41901 (#1) has exited
alert: worker 41904 (#2) has exited
alert: worker 41906 (#3) has exited
info: all workers gone
notice: cluster complete, Bye!
```

ActionHero is intended to be run on `*nix` operating systems. The `start` and `start cluster` commands provide support for signaling. (There is limited support for some of these commands in windows).

**actionhero start**

*   `kill` / `term` / `int` : Process will attempt to "gracefully" shut down. That is, the worker will close all server connections (possibly sending a shutdown message to clients, depending on server type), stop all task workers, and eventually shut down. This action may take some time to fully complete.
*   `USR2`: Process will restart itself. The process will preform the "graceful shutdown" above, and they restart.

**actionhero start cluster**

All signals should be sent to the cluster master process. You can still signal the termination of a worker, but the cluster manager will start a new one in its place.

*   `kill` / `term` / `int`: Will signal the master to "gracefully terminate" all workers. Master will terminate once all workers have completed
*   `HUP` : Restart all workers.
*   `USR2` : "Hot reload". Worker will kill off existing workers one-by-one, and start a new worker in their place. This is used for 0-downtime restarts. Keep in mind that for a short while, your server will be running both old and new code while the workers are rolling.
*   `TTOU`: remove one worker
*   `TTIN`: add one worker

## Shutting Down

When using `actionhero start` or `actionhero start cluster`, when you signal ActionHero to stop via the signals above (or from within your running application via `api.commands.stop()`), actionhero will attempt to gracefully shutdown. This will include running any initializer's `stop()` method. This will close any open servers, and attempt to allow any running tasks to complete.

Because things sometimes go wrong, `actionhero start` and `actionhero start cluster` also have a "emergency stop" timeout. This defaults to 30 seconds, and is configurable via the `ACTIONHERO_SHUTDOWN_TIMEOUT` environment variable. Be sure that your tasks and actions can complete within that window, or else raise that shutdown limit.

## Windows Specific Notes

*   Sometimes ActionHero may require a git-based module (rather than a NPM module). You will need to have git installed. Depending on how you installed git, it may not be available to the node shell. Be sure to have also installed references to git. You can also run node/npm install from the git shell.*   Sometimes, npm will not install the actionhero binary @ `/node_modules/.bin/actionhero`, but rather it will attempt to create a windows executable and wrapper. You can launch ActionHero directly with `./node_modules/actionhero/bin/actionhero`
