# Running actionhero

## The actionhero Binary

```bash
Binary options:
* help (default)
* start
* startCluster
* generate
* generateAction
* generateTask
* generateInitializer
* generateServer

Descriptions:

* actionhero help
  will display this document

* actionhero generate
  will prepare an empty directory with a template actionhero project

* actionhero generateAction --name=[name] --description=[description] --inputsRequired=[inputsRequired] --inputsOptional=[inputsOptional]
  will generate a new action in `actions`
  [name] (required)
  [description] (required) should be wrapped in quotes if it contains spaces

* actionhero generateTask --name=[name] --description=[description] --scope=[scope] --frequency=[frequency] 
  will generate a new task in `tasks`
  [name] (required)
  [description] (required) should be wrapped in quotes if it contains spaces
  [scope] (optional) can be "any" or "all"
  [frequency] (optional)

* actionhero generateInitializer --name=[name]
  will generate a new initializer in `initializers`
  [name] (required)

* actionhero generateServer --name=[name]
  will generate a new server in `servers`
  [name] (required)

* actionhero start --config=[/path/to/config/] --title=[processTitle]  --daemon
  will start a template actionhero server
  this is the respondant to `npm start`
  [config] (optional) path to /config, defaults to `process.cwd() + "/" + config`. You can also use ENV[ACTIONHERO_CONFIG].
  [title] (optional) process title to use for actionhero-s ID, ps, log, and pidFile defaults. Must be unique for each member of the cluster.  You can also use ENV[ACTIONHERO_TITLE]. Process renaming does not work on OSX/Windows
  [daemon] (optional) to fork and run as a new background process defalts to false

* actionhero startCluster --exec=[command] --workers=[numWorkers] --pidfile=[path] --log=[path] --title=[clusterTitle] --workerTitlePrefix=[prefix] --config=[/path/to/config]  --daemon
  will launch a actionhero cluster (using node-s cluster module)
  [exec] (optional) command for the cluster-master to run to stat the workers
  [workers] (optional) number of workers (defaults to # CPUs - 2)
  [pidfile] (optional) pidfile localtion (defaults to process.cwd() + /pids)
  [log] (optional) logfile (defaults to process.cwd() + /log/cluster.log)
  [title] (optional) default actionhero-master  Does not work on OSX/Windows
  [workerTitlePrefix] (optional) default actionhero-worker
  [config] (optional) path to /config for workers, defaults to `process.cwd() + "/" + config`. You can also use ENV[ACTIONHERO_CONFIG]
  [daemon] (optional) to fork and run as a new background process defalts to false

More Help & the actionhero documentation can be found @ http://actionherojs.com
```

The suggested method to run your actionhero server is to use the included `./node_modules/.bin/actionhero` binary.  Note that there is no `main.js` or specific start script your project needs.  actionhero handles this for you.  Your actionhero project simply needs to follow the proper directory conventions and it will be bootable.

At the time of this writing the actionhero binary's help contains:

## Linking the actionhero binary

* If you installed actionhero globally (`npm install actionhero -g`) you should have the `actionhero` binary available to you within your shell at all times.
* Otherwise, you can reference the binary from either `./node_modules/.bin/actionhero` or `./node_modules/actionhero/bin/actionhero`.
* If you installed actionhero locally, you can add a reference to your path (OSX and Linux): `export PATH=$PATH:node_modules/.bin` to be able to use simpler commands, IE `actionhero start`. On windows this can be done by running `set PATH=%PATH%;%cd%\node_modules\.bin` at command prompt (not powershell).

## Environments and Config

By default, actionhero will use the settings found in the `exports.default` blocks in `/config/`.  However, you can set environment-specfic overrides or changes.  actionhero inspects `process.env.NODE_ENV` to load up runtime configuration overrides from `exports.#{env}` blocks in your configuration files.  This is the recommended way to have separate settings for staging and production.

The load order of configs is:
- default values in `/config`
- environment-specific values in `/config`
- options passed in to boot with `actionhero.start({configChanges: configChanges}, callback)`

## Programatic Use of actionhero

```javascript
var actionheroPrototype = require("actionhero").actionheroPrototype;
var actionhero = new actionheroPrototype();

var timer = 5000;
actionhero.start(params, function(err, api){
  
  api.log(" >> Boot Successful!");
  setTimeout(function(){
    
    api.log(" >> restarting server...");
    actionhero.restart(function(err, api){
      
      api.log(" >> Restarted!");
      setTimeout(function(){
        
        api.log(" >> stopping server...");
        actionhero.stop(function(err, api){
          
          api.log(" >> Stopped!");
          process.exit();
          
        });
      }, timer);
    })
  }, timer);
});
```

While **NOT** encouraged, you can always instantiate an actionhero server yourself.  Perhaps you wish to combine actionhero with an existing project.  Here's how!  Take note that using these methods will not work for actionCluster, and only a single instance will be started within your project.  

Feel free to look at the source of `./node_modules/actionhero/bin/include/start` to see how the main actionhero server is implemented for more information.

You can programmatically control an actionhero server with `actionhero.start(params, callback)`, `actionhero.stop(callback)` and `actionhero.restart(callback)`

From within actionhero itself (actions, initilizers, etc), you can use `api.commands.start`, `api.commands.stop`, and `api.commands.restart` to control the server. 

## Grunt

```javascript
// A custom GRUNT actionhero task
grunt.registerTask('myTask','description of task', function(arg1, arg2){
  var done = this.async()
  grunt.startActionhero(function(api){
    // your logic here

    done()
  })
})
```

actionhero integrates with [grunt](http://gruntjs.com/) to allow you to tun manual tasks within actionhero's environment.  Those of you coming from Ruby, grunt is very similar to `rake` or `make`.

To use grunt, you should install grunt globally `npm install -g grunt-cli`

actionhero will generate a few example tasks in `./gruntfile.js` to help you save and restore the cache and manage tasks.  Most importantly, an `init` wrapper is defined for you.  Require this in all of you tasks so you can have access to the `api` object. Note that all your grunt tasks should be async (`var done = this.async()`), and you will need to call `done()` at the conclustion of the task. 

You will have access to all of your initializers, actions, and tasks within the api object.  `api` will represent an initialized sever, but not a started one.  Your initializer's "_start" methods will not be run, nor will the servers be started.  For example:

As always, you can list your project's grunt tasks with `grunt -help`

```bash
# Checking the existing actionhero grunt commands
> grunt --help

                   list  List your actions and metadata
enqueueAllPeriodicTasks  This will enqueue all periodic tasks (could lead to
                         duplicates)
    enqueuePeriodicTask  Enqueue a periodic task (:taskName)
       stopPeriodicTask  Remove an enqueued periodic task (:taskName)
             flushRedis  Clear the entire actionhero redis database
             clearCache  Clear the actionhero cache
              dumpCache  Save the current cache as a JSON object (:file)
              loadCache  Set the cache from a file (overwrites existing cache)
                         (:file)
```

You can [learn more about grunt here](http://gruntjs.com/).

## Signals

```bash
> ./node_modules/.bin/actionhero startCluster --workers=2
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

actionhero is intended to be run on `*nix` operating systems.  The `start` and `startCluster` commands provide support for signaling. (There is limited support for some of these commands in windows).

**actionhero start**

- `kill` / `term` / `int` : Process will attempt to "gracefully" shut down.  That is, the worker will close all server connections (possibly sending a shutdown message to clients, depending on server type), stop all task workers, and eventually shut down.  This action may take some time to fully complete.
- `USR2`: Process will restart itself.  The process will preform the "graceful shutdown" above, and they restart.

**actionhero startCluster**

All signals should be sent to the cluster master process.  You can still signal the termination of a worker, but the cluster manager will start a new one in its place.

- `kill` / `term` / `int`:  Will signal the master to "gracefully terminate" all workers.  Master will terminate once all workers have completed
- `USR2` / `HUP` : "Hot reload".  Worker will kill off existing workers one-by-one, and start a new worker in their place.  This is used for 0-downtime restarts.  Keep in mind that for a short while, your server will be running both old and new code while the workers are rolling.
- `WINCH`: "Gracefully terminate" all workers.  Only the master will remain running
- `TTOU`: remove one worker
- `TTIN`: add one worker

## Windows-Specific Notes

- Sometimes actionhero may require a git-based module (rather than a NPM module).  You will need to have git installed.  Depending on how you installed git, it may not be available to the node shell.  Be sure to have also installed references to git.  You can also run node/npm install from the git shell. 
- Sometimes, npm will not install the actionhero binary @ `/node_modules/.bin/actionhero`, but rather it will attempt to create a windows executable and wrapper.  You can launch actionhero directly with `./node_modules/actionhero/bin/actionhero`
