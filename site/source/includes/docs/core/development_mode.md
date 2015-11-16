# Development Mode
**Don't use this in production!**

## About

```javascript
config.general = {
  developmentMode: true
}
```

actionhero's development mode is a little different than tools like [nodemon](https://github.com/remy/nodemon) in that it tries hard not to restart the server process. Changes to routes, tasks, and actions can simply replace those in memory when they are updated on disk. Other changes, like changes to `api.config` or initializers are more severe, and will restart the whole application (much like nodemon).

To enable development mode simply set `developmentMode: true` in your `config/api.js`.

## Effects of Development Mode

Development mode, when enabled, will poll for changes in your actions, tasks and initializers, and reload them on the fly.

- this uses `fs.watchFile()` and may not work on all OSs / file systems.
- new files won't be loaded in, only existing files when the app was booted will be monitored
- as deleting a file might crash your application, we will not attempt to re-load deleted files
- if you have changed the `task.frequency` of a periodic task, you will continue to use the old value until the task fires at least once after the change 
- changing `api.config`, initializers, or servers, will attempt to do a "full" reboot the server rather than just reload that component.

## Watching custom files

```javascript
api.watchFileAndAct(path_to_file, function(){
  api.log('rebooting due to config change: ' + path_to_file, 'info');
  api.commands.restart.call(api._self);
});
```

You can use actionhero's `watchFileAndAct()` method to watch additional files your application may have:

## Debugging

You can use the awesome [node-inspector](https://github.com/dannycoates/node-inspector) project to help you debug your actionhero application within the familar Chrome Browser's developer tools.

Be sure to run actionhero with node's `--debug` flag, ie: `node ./node_modules/.bin/actionhero start --debug`

```javascript
// in package.json
"dependencies": {
  "actionhero": "x",
  "node-inspector": "x"
},
```

Start up node-inspector (both node-inspector and actionhero have the same default port, so you will need to change one of them) `./node_modules/.bin/node-inspector --web-port=1234`

That's it! Now you can visit `http://0.0.0.0:1234/debug?port=5858` and start debugging.  Remember that the way node-debugger works has you first set a breakpoint in the file view, and then you can use the console to inspect various objects.  IE: I put a breakpoint in the default `status` action in the `run` method:

## REPL

```bash
> grunt console
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
[ AH::development ] >> api.id
'10.0.1.15'
[ AH::development ] >> Object.keys(api.actions.actions)
[ 'cacheTest',
  'randomNumber',
  'showDocumentation',
  'sleepTest',
  'status' ]
```

actionhero now has a REPL (`v9.0.0`)! This means you can 'connect' to a running instance of actionhero and manually call all the methods on the `api` namespace.  This combined with the new RPC tools make this a powerful debugging and development tool.  Running `grunt console` will load up a version of action hero in your terminal where you have access to the `api` object.  This version of the server will `boot`, `initialize`, and `start`, but will skip booting any `servers`.  

The REPL will:

- source `NODE_ENV` properly to load the config
- will connect to redis and load any user-defined initializers
- will load any plugins
- will **not** boot any servers

If you are familiar with rails, this is very similar to `rails console`

<img src="https://cloud.githubusercontent.com/assets/303226/2953485/4db6cbe2-da5b-11e3-96de-26fe4931d9af.png">