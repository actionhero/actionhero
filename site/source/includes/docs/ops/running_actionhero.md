# Running actionhero

## The actionhero Binary

```bash
ActionHero - A multi-transport node.js API Server with integrated cluster
  capabilities and delayed tasks

Binary options:
* help (default)
* start
* start cluster
* generate
* generate action
* generate task
* generate initializer
* generate server
* actions list
* tasks enqueue
* console
* link
* unlink

Descriptions:

* actionhero help
  will display this document

* actionhero start --config=[/path/to/config] --title=[processTitle]
    --daemon
  [config] (optional) path to config.js, defaults to "process.cwd() + '/'
    + config.js". You can also use ENV[ACTIONHERO_CONFIG].
  [title] (optional) process title to use for ActionHero's ID, ps, log, and
    pidFile defaults. Must be unique for each member of the cluster.
    You can also use ENV[ACTIONHERO_TITLE].
    Process renaming does not work on OSX/Windows
  [daemon] (optional) to fork and run as a new background process defaults
    to false

* actionhero start cluster --workers=[numWorkers]  --daemon
  will launch a ActionHero cluster (using node-s cluster module)
  [workers] (optional) number of workers (defaults to # CPUs - 2)
  [daemon] (optional) to fork and run as a new background process defaults
    to false

* actionhero generate
  will prepare an empty directory with a template ActionHero project

* actionhero generate action --name=[name] --description=[description]
  will generate a new action in "actions"
  [name] (required)
  [description] (optional)

* actionhero generate task --name=[name] --description=[description]
    --scope=[scope] --frequency=[frequency]
  will generate a new task in "tasks"
  [name] (required)
  [description] (optional)
  [queue] (required)
  [frequency] (optional)

* actionhero generate initializer --name=[name] --loadPriority=[p]
    --startPriority=[p] --stopPriority=[p]
  will generate a new initializer in "initializers"
  [name] (required)
  [loadPriority] (optional)
  [startPriority] (optional)
  [stopPriority] (optional)

* actionhero generate server --name=[name]
  will generate a new server in "servers"
  [name] (required)

* actionhero actions list
  will list all actions in this server to stdout

* actionhero task enqueue --name=[taskName] --args=[JSON-formatted args]
  will enqueue a task into redis

* actionhero console
  will open an interactive CLI with the API object in scope.
  this is sometimes called a REPL

* actionhero link --name=[pluginName] --overwriteConfig=[overwriteConfig]
  will link the actions, tasks, initializers, etc from a plugin into your
    top-level project normally, you will have first installed the plugin
    via `npm install myPlugin`
  [name] (required)
  [overwriteConfig] (optional) default: false

* actionhero unlink --name=[pluginName]
  will remove the linked actions, tasks, initializers, etc from a plugin in your
    top-level project. Please remove the config files manually
  Remember if your plugin was installed via NPM, also be sure to remove it from your
    package.json or uninstall it with npm uninstall --save
  [name] (required)

#############################################################
## More Help & the ActionHero documentation can be found @ ##
##             http://www.actionherojs.com                 ##
#############################################################
```

The suggested method to run your ActionHero server is to use the included `./node_modules/.bin/actionhero` binary.  Note that there is no `main.js` or specific start script your project needs.  ActionHero handles this for you.  Your ActionHero project simply needs to follow the proper directory conventions and it will be bootable.

At the time of this writing the ActionHero binary's help contains:

## Linking the ActionHero binary

* If you installed ActionHero globally (`npm install actionhero -g`) you should have the `actionhero` binary available to you within your shell at all times.
* Otherwise, you can reference the binary from either `./node_modules/.bin/actionhero` or `./node_modules/actionhero/bin/actionhero`.
* If you installed ActionHero locally, you can add a reference to your path (OSX and Linux): `export PATH=$PATH:node_modules/.bin` to be able to use simpler commands, IE `actionhero start`. On windows this can be done by running `set PATH=%PATH%;%cd%\node_modules\.bin` at command prompt (not powershell).

## Environments and Config

By default, ActionHero will use the settings found in the `exports.default` blocks in `/config/`.  However, you can set environment-specfic overrides or changes.  ActionHero inspects `process.env.NODE_ENV` to load up runtime configuration overrides from `exports.#{env}` blocks in your configuration files.  This is the recommended way to have separate settings for staging and production.

The load order of configs is:
- default values in `/config`
- environment-specific values in `/config`
- options passed in to boot with `actionhero.start({configChanges: configChanges}, callback)`

## Programatic Use of ActionHero

```javascript
var actionheroPrototype = require("actionhero").actionheroPrototype;
var actionhero = new actionheroPrototype();

var timer = 5000;
actionhero.start(params, function(error, api){

  api.log(" >> Boot Successful!");
  setTimeout(function(){

    api.log(" >> restarting server...");
    actionhero.restart(function(error, api){

      api.log(" >> Restarted!");
      setTimeout(function(){

        api.log(" >> stopping server...");
        actionhero.stop(function(error, api){

          api.log(" >> Stopped!");
          process.exit();

        });
      }, timer);
    })
  }, timer);
});
```

While **NOT** encouraged, you can always instantiate an ActionHero server yourself.  Perhaps you wish to combine ActionHero with an existing project.  Here's how!  Take note that using these methods will not work for actionCluster, and only a single instance will be started within your project.  

Feel free to look at the source of `./node_modules/actionhero/bin/include/start` to see how the main ActionHero server is implemented for more information.

You can programmatically control an ActionHero server with `actionhero.start(params, callback)`, `actionhero.stop(callback)` and `actionhero.restart(callback)`

From within ActionHero itself (actions, initilizers, etc), you can use `api.commands.start`, `api.commands.stop`, and `api.commands.restart` to control the server.

## Signals

```bash
> ./node_modules/.bin/actionhero start cluster --workers=2
info: actionhero >> startCluster
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
kill -s TTIN `cat pids/cluster_pidfile`

info: worker 41632 (#3) has spawned
info: Worker #3 [41632]: starting
info: Worker #3 [41632]: started

# A new terminal
kill -s KILL `cat pids/cluster_pidfile`

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

ActionHero is intended to be run on `*nix` operating systems.  The `start` and `startCluster` commands provide support for signaling. (There is limited support for some of these commands in windows).

**actionhero start**

- `kill` / `term` / `int` : Process will attempt to "gracefully" shut down.  That is, the worker will close all server connections (possibly sending a shutdown message to clients, depending on server type), stop all task workers, and eventually shut down.  This action may take some time to fully complete.
- `USR2`: Process will restart itself.  The process will preform the "graceful shutdown" above, and they restart.

**actionhero start cluster**

All signals should be sent to the cluster master process.  You can still signal the termination of a worker, but the cluster manager will start a new one in its place.

- `kill` / `term` / `int`:  Will signal the master to "gracefully terminate" all workers.  Master will terminate once all workers have completed
- `HUP` : Restart all workers.
- `USR2` : "Hot reload".  Worker will kill off existing workers one-by-one, and start a new worker in their place.  This is used for 0-downtime restarts.  Keep in mind that for a short while, your server will be running both old and new code while the workers are rolling.
- `TTOU`: remove one worker
- `TTIN`: add one worker

## Shutting Down
When using `actionhero start` or `actionhero start cluster`, when you signal ActionHero to stop via the signals above (or from within your running application via `api.commands.stop()`), actionhero will attempt to gracefully shutdown.  This will include running any initializer's `stop()` method.  This will close any open servers, and attempt to allow any running tasks to complete.

Because things sometimes go wrong, `actionhero start` and `actionhero start cluster` also have a "emergency stop" timeout.  This defaults to 30 seconds, and is configurable via the `ACTIONHERO_SHUTDOWN_TIMEOUT` environment variable.  Be sure that your tasks and actions can complete within that window, or else raise that shutdown limit.

## Windows-Specific Notes

- Sometimes ActionHero may require a git-based module (rather than a NPM module).  You will need to have git installed.  Depending on how you installed git, it may not be available to the node shell.  Be sure to have also installed references to git.  You can also run node/npm install from the git shell.
- Sometimes, npm will not install the actionhero binary @ `/node_modules/.bin/actionhero`, but rather it will attempt to create a windows executable and wrapper.  You can launch ActionHero directly with `./node_modules/actionhero/bin/actionhero`
