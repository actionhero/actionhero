---
layout: wiki
title: Wiki - Production Notes
---

# Production Notes
A collection of thoughts on deploying actionhero apps

## Paths and Environments

You can set a few environment variables to affect how actionhero runs:

- `PROJECT_ROOT`: This is useful when deploying actionhero applications on a server where symlinks will change under a running process.  The cluster will look at your symlink `PROJECT_ROOT=/path/to/current_symlink` rather than the absolute path it was started from
- `ACTIONHERO_ROOT`: This can used to set the absolute path to the actionhero binaries
- `ACTIONHERO_CONFIG`: This can be user to set the absolute path to the actionhero config file you wish to use.  This is useful when you might have a `staging.config.json` and a `production.config.json`
- `ACTIONHERO_TITLE`: The value of `api.id`, and the name for the pidfile in some boot configurations

## Daemon

When deploying actionhero, you will probably have more than 1 process.  You can use the cluster manager to keep an eye on the workers and manage them

- Start the cluster with 2 workers: `./node_modules/.bin/actionhero startCluster --workers=2`

When deploying new code, you can gracefully restart your workers by sending the `USR2` signal to the cluster manager to signal a reload to all workers.  You don't need to start and stop the cluster-master.  This allows for 0-downtime deployments.  

You may want to set some of the ENV variables above to help with your deployment.

## Number of workers

When choosing the number of workers (`--workers=n`) for your actionhero cluster, choose at least 1 less than the number of CPUs available.  If you have a "burstable" architecture (like a Joyent smart machine), opt for the highest number of 'consistent' CPUs you can have, meaning a number of CPUs that you will always have available to you.  

You never want more workers than you can run at a time, or else you will actually be slowing down the execution of all processes.

Of course, not going in to swap memory is more important than utilizing all of your CPUs, so if you find yourself running out of ram, reduce the number of workers! 

## Pidfiles

actionhero will write its pid to a pidfile in the normal unix way.  The path for the pidfile is set in `config.js` with `config.general.paths.pid`.  

Individual actionhero servers will name their pidfiles by `api.id`, which is determined by the logic [here](https://github.com/evantahler/actionhero/blob/master/initializers/pids.js) and [here](https://github.com/evantahler/actionhero/blob/master/initializers/id.js).  For example, on my laptop with the IP address of `192.168.0.1`, running `npm start` would run one actionhero server and generate a pidfile of `./pids/actionhero-192.168.0.1` in which would be a single line containg the process' pid.

When running the cluster, the cluster process first writes his own pidfile to `process.cwd() + './pids/cluster_pidfile'`.  Then, every worker the cluster master creates will have a pid like `actionhero-worker-1` in the location defined by `config.js`.

## Git-based deployment Example

To send a signal to the cluster master process to reboot all its workers (`USR2`), you can cat the pidfile (bash):
```bash
kill -s USR2 `cat /path/to/pids/cluster_pidfile`
```

If you want to setup a git-based deployment, the simplest steps would be something like:

```bash
#!/usr/bin/env bash
# assuming the actionhero cluster master process is already running

DEPLOY_PATH=/path/to/your/application

cd $DEPLOY_PATH && git pull
cd $DEPLOY_PATH && npm install
# run any grunt tasks here, like perhaps an asset compile step or a database migration
cd $DEPLOY_PATH && kill -s USR2 `cat pids/cluster_pidfile`
```

## Global Packages

It's probably best to avoid installing any global packages.  This way, you won't have to worry about conflicts, and your project can be kept up to date more easily.  When using npm to install a local package the package's binaries are always copied into `./node_modules/.bin`. 

You can add local references to your $PATH like so to use these local binaries:

`export PATH=$PATH:node_modules/.bin`

## Security

Be sure to change `api.config.general.serverToken` to something unique for your application