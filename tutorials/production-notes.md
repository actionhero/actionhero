![](ops-tools.svg)

## Topology Example

Here is a common ActionHero production topology:

![AH Cluster](cluster.png)

Notes:

* It's best to separate the "workers" from the web "servers" into distinct processes.
    * Be sure to modify the config files for each type of server accordingly (ie: turn of all servers for the workers, and turn of all workers on the servers).
* To accomplish the above, you only need to make changes to your configuration files on each server. You will still be running the same same ActionHero project codebase. See the example:
* Always have a replica of redis!

```js
// Assume we use the flag \`process.env.ACTIONHERO_ROLE\` to denote the type of server
// You can set this variable in the ENV of your server or launch each process with the flag:
// Worker => \`ACTIONHERO_ROLE='worker' npm start\`
// Server => \`ACTIONHERO_ROLE='server' npm start\`

// config/tasks.js

exports.production = {
    tasks: function(api){

        // default to config for 'server'
        let config = {
          scheduler: false,
          queues: ['*'],
          verbose: true,
          // ...
        };

        if(process.env.ACTIONHERO_ROLE === 'worker'){
            config.scheduler = true;
            config.minTaskProcessors = 1;
            config.maxTaskProcessors = 10;
        }

        return config;
    }
};

// config/servers/web.js

exports.default = {
    servers: {
        web: function(api){
            config = {
                enabled: true,
                secure: false,
                serverOptions: {},
                port: process.env.PORT || 8080
                // ...
            };

            if(process.env.ACTIONHERO_ROLE === 'worker'){
                config.enabled = false;
            }

            return config;
        }
    }
};
```

## Paths and Environments

You can set a few environment variables to affect how ActionHero runs:

* `PROJECT_ROOT`: This is useful when deploying ActionHero applications on a server where symlinks will change under a running process. The cluster will look at your symlink `PROJECT_ROOT=/path/to/current_symlink` rather than the absolute path it was started from
* `ACTIONHERO_ROOT`: This can used to set the absolute path to the ActionHero binaries
* `ACTIONHERO_CONFIG`: This can be user to set the absolute path to the ActionHero config directory you wish to use. This is useful when you might have a variable configs per server
* `ACTIONHERO_TITLE`: The value of `api.id`, and the name for the pidfile in some boot configurations

## Daemon

When deploying ActionHero, you will probably have more than 1 process. You can use the cluster manager to keep an eye on the workers and manage them

* Start the cluster with 2 workers: `actionhero start cluster --workers=2`

When deploying new code, you can gracefully restart your workers by sending the `USR2` signal to the cluster manager to signal a reload to all workers. You don't need to start and stop the cluster-master. This allows for 0-downtime deployments.

You may want to set some of the ENV variables above to help with your deployment.

## Number of Workers

When choosing the number of workers (`--workers=n`) for your ActionHero cluster, choose at least 1 less than the number of CPUs available. If you have a "burstable" architecture (like a Joyent smart machine), opt for the highest number of 'consistent' CPUs you can have, meaning a number of CPUs that you will always have available to you.

You never want more workers than you can run at a time, or else you will actually be slowing down the execution of all processes.

Of course, not going in to swapping memory is more important than utilizing all of your CPUs, so if you find yourself running out of RAM, reduce the number of workers!

## Pidfiles

ActionHero will write its pid to a pidfile in the normal unix way. The path for the pidfile is set in `config/api.js` with `config.general.paths.pid`.

Individual ActionHero servers will name their pidfiles by `api.id`, which is determined by the logic [here](https://github.com/actionhero/actionhero/blob/master/initializers/pids.js) and [here](https://github.com/actionhero/actionhero/blob/master/initializers/id.js). For example, on my laptop with the IP address of `192.168.0.1`, running `npm start` would run one ActionHero server and generate a pidfile of `./pids/actionhero-192.168.0.1` in which would be a single line containing the process' pid.

When running the cluster, the cluster process first writes his own pidfile to `process.cwd() + './pids/cluster_pidfile'`. Then, every worker the cluster master creates will have a pid like `actionhero-worker-1` in the location defined by `config/api.js`.

To send a signal to the cluster master process to reboot all its workers (`USR2`), you can cat the pidfile (bash): `kill -s USR2 'cat /path/to/pids/cluster_pidfile'`

## Git-based Deployment

If you want to setup a git-based 0-downtime deployment, the simplest steps would be something like =>

```bash
#!/usr/bin/env bash
# assuming the ActionHero cluster master process is already running

DEPLOY_PATH=/path/to/your/application

cd $DEPLOY_PATH && git pull
cd $DEPLOY_PATH && npm install
# run any build tasks here, like perhaps an asset compile step or a database migration
cd $DEPLOY_PATH && kill -s USR2 \`cat pids/cluster_pidfile\`
```

## PAAS and Procfile Deployment

When deploying to a Platform as a Service (PAAS) cluster (like [Heroku](https://heroku.com), [Flynn](https://flynn.io), and even some [Docker](https://www.docker.com) deployments), we can offer a few pieces of advice.

If you are deploying a separate WEB and WORKER process type, you can define them in a [`Procfile`](https://devcenter.heroku.com/articles/procfile) and make use of environment variable overrides in addition to those defined from the environment. You can modify your config files to use these options:

```bash
# ./Procfile
web:    SCHEDULER=false \\
        MIN_TASK_PROCESSORS=0 \\
        MAX_TASK_PROCESSORS=0 \\
        ENABLE_WEB_SERVER=true  \\
        ENABLE_TCP_SERVER=true  \\
        ENABLE_WEBSOCKET_SERVER=true  \\
        ./node_modules/.bin/actionhero start

worker: SCHEDULER=true  \\
        MIN_TASK_PROCESSORS=5 \\
        MAX_TASK_PROCESSORS=5 \\
        ENABLE_WEB_SERVER=false \\
        ENABLE_TCP_SERVER=false \\
        ENABLE_WEBSOCKET_SERVER=false \\
        ./node_modules/.bin/actionhero start
```

Be sure **not** to use NPM in your `Procfile` definitions. In many deployment scenarios, NPM will not properly pass signals to the ActionHero process and it will be impossible to signal a graceful shutdown. Examples of this behavior can be found [here](https://github.com/flynn/flynn/issues/3601) and [here](https://github.com/npm/npm/issues/4603)

## Global Packages

It is best to avoid installing any global packages. This way, you won't have to worry about conflicts, and your project can be kept up to date more easily. When using npm to install a local package the package's binaries are always copied into `./node_modules/.bin`.

You can add local references to your $PATH like so to use these local binaries:

`export PATH=$PATH:node_modules/.bin`

ActionHero is not designed to function when installed globally.  Do not install ActionHero globally, using `npm install -g`

## Nginx Example

While ActionHero can be the font-line server your users hit, it's probably best to proxy ActionHero behind a load balancer, nginx, haproxy, etc. This will help you pool connections before hitting node, SSL terminate, serve static assets, etc.

Here is an example nginx config for interfacing with ActionHero, including using sockets (not http) and handing the websocket upgrade path.

* Note the proxy-pass format to the socket: `{`proxy_pass http://unix:/path/to/socket`}`
* Note some of the extra work you need to have for the websocket upgrade headers (the primus directive)

```js
// From \`config/servers/web.js\`

exports.production = {
  servers: {
    web: function(api){
      return {
        port: '/home/USER/www/APP/current/tmp/sockets/actionhero.sock',
        bindIP: null,
        metadataOptions: {
          serverInformation: false,
          requesterInformation: false
        }
      }
    }
  }
}
```

```bash
# The nginx.conf:

#user  nobody;
worker_processes  4;

error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;


events {
  worker_connections 1024;
  accept_mutex on;
}


http {
    include       mime.types;
    default_type  application/octet-stream;
    server_tokens off;
    sendfile        on;
    keepalive_timeout  65;

    set_real_ip_from  X.X.X.X/24;
    real_ip_header    X-Forwarded-For;

    gzip on;
    gzip_http_version 1.0;
    gzip_comp_level 9;
    gzip_proxied any;
    gzip_types text/plain text/xml text/css text/comma-separated-values text/javascript application/x-javascript font/ttf font/otf image/svg+xml application/atom+xml;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent" "$http_x_forwarded_for" $request_time';

    server {
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $http_host;
        proxy_set_header X_FORWARDED_PROTO https;
        proxy_redirect off;

        listen       80;
        server_name  _;

        access_log  /var/log/nginx/access.log  main;
        error_log   /var/log/nginx/error.log;

        root        /home/XXUSERXX/XXAPPLICATIONXX/www/current/public/;
        try_files /$uri/index.html /cache/$uri/index.html /$uri.html /cache/$uri.html /$uri /cache/$uri @app;

        client_max_body_size 50M;

        location /primus {
            proxy_http_version 1.1;
            proxy_buffering off;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "Upgrade";
            proxy_set_header Host $host;

            proxy_pass http://unix:/home/XXUSERXX/www/XXAPPLICATIONXX/shared/tmp/sockets/actionhero.sock;
        }

        location / {
            proxy_http_version 1.1;
            proxy_buffering off;
            proxy_cache_bypass $http_pragma $http_authorization;
            proxy_no_cache $http_pragma $http_authorization;

            proxy_pass http://unix:/home/XXUSERXX/www/XXAPPLICATIONXX/shared/tmp/sockets/actionhero.sock;
        }
    }

}
```

## Redis High-Availability

[Redis](http://redis.io/) is technically optional in ActionHero environments, but you will need it if you want to coordinates tasks across a cluster of workers, handle group chat mechanics between WebSocket clients, or do other cross-cluster operations. In those cases, you'll want your Redis setup to be reliable. There are 2 methods to achieving HA redis: Sentinels and Cluster. A simple architectural wireframe of how to deploy the various options is below The [`ioredis`](https://github.com/luin/ioredis) node package supports both of these connection schemes, and all you need to change is your connection options.

![](redis.png)

### Sentinel Mode

In Sentinel mode, you have your Redis configured in a normal master->slave configuration. However, rather than hard-code your application to know who the master and slaves are, your application connects to the Sentinel processes instead. These Sentinels transparently pipeline your connection to the proper Redis master, and they do this invisibly to ActionHero / your application.

The biggest advantage to this configuration is high-availability. In the event of a master failure, the Sentinel processes reach a consensus, then elect a new master automatically. Since the same process which handles master election also manages the client connections, no requests are lost - the sentinels hold the connection idle and then replay any pending requests on the new master after election. In the configuration shown in the first diagram above, up to 2 Redis data nodes and any 1 Sentinel can fail without the entire system failing.

Note that it is not necessary to run the Sentinel nodes on separate servers. They can be run as parallel processes on the Redis nodes themselves.

To run this configuration, configure ioredis with a list of the Sentinel nodes and the name of the cluster. The driver will automatically connect to an appropriate Sentinel in round-robin fashion, reconnecting to another node if one is down, or fails.

An example of a `redis.js` config file for sentinels would be:

```js
exports.production = {
  redis: function(api){
    return {
      channel: 'actionhero-myApp',
      rpcTimeout: 5000,

      pkg: 'ioredis',
      port: null,
      host: null,
      password: 'redis-password',
      database: 0,

      options: {
        name: 'myCluster',
        password: 'redis-password',
        db: 0,
        sentinels: [
          { host: '1.2.3.4', port: 26379 },
        ]
      }
    }
  }
}
```

### Cluster Mode

In Cluster mode, Redis shards all the keys in data into "slots" which are evenly allocated though all the masters in the cluster. The client can connect to any node in the cluster, and if the requested key belongs on another node, it will proxy the request for you (just like the Sentinel would). The cluster can also take care of master re-election for each shard in the event of a master node failure.

Cluster mode provides similar high-availability to Sentinel mode, but the sharding allows more data to be stored in the cluster overall. However, where Sentinel mode requires a minimum of 3 servers, Cluster mode requires a minimum of 6 to reach a quorom and provide full redundancy.

Also an important note: while you may opt to run "sentinel processes", it's the same codebase as regular redis, just running in "sentinel mode". The same goes if you run redis in "cluster mode".

An example of a `redis.js` config file for redis cluster would be: **TODO**

## Best Practices

As ActionHero is a framework, much of the work for keeping your application secure is dependent on the types of actions and tasks you create. That said, here is a list of general best-practices for ensuring your deployment is as robust as it can be:

### General Configuration

* Be sure to change `api.config.general.serverToken` to something unique for your application
* Turn off [developer mode](tutoria.development-mode.html) in production.
* Use `api.config.general.filteredParams` to hide sensitive information from the logs. You probably don't want to log out `password`, `credit_card`, and other things of that nature.

### Topology

Run a cluster via `start cluster`. This will guarantee that you can reboot your application with 0 downtime and deploy new versions without interruption.

  * You can run 1 ActionHero instance per core (assuming the server is dedicated to ActionHero), and that is the default behavior of `start cluster`.
  * You don't need a tool like PM2 to manage ActionHero cluster process, but you can use it if you like.
  * You can use an init script to `start cluster` at boot, or use a tool like [monit](https://mmonit.com/monit/) to do it for you.

Never run tasks on the same ActionHero instances you run your servers on; never run your servers on the same ActionHero instances you run your tasks on.

  * Yes, under most situations running servers + tasks on the same instance will work OK, but the load profiles (and often the types of packages required) vary in each deployment. Actions are designed to respond quickly and offload hard computations to tasks. Tasks are designed to work slower computations.
  * Do any CPU-intensive work in a task. If a client needs to see the result of a CPU-intensive operation, poll for it (or use web-sockets)

Use a centralized logging tool like Splunk, ELK, SumoLogic, etc. ActionHero is /built for the cloud/, which means that it expects pids, application names, etc to change, and as such, will create many log files. Use a centralized tool to inspect the state of your application.

  * Log everything. You never know what you might want to check up on. {`ActionHero's`} logger has various levels you can use for this.

Split out the redis instance you use for cache from the one you use for tasks. If your cache fills up, do you want task processing to fail?

Your web request stack should look like: [Load Balancer] -> [App Server] -> [Nginx] -> [ActionHero]

  * This layout allows you to have control, back-pressure and throttling at many layers.
  * Configure Nginx to serve static files whenever possible to remove load from ActionHero, and leave it just to process actions

Use a CDN. ActionHero will serve static files with the proper last-modified headers, so your CDN should respect this, and you should not need to worry about asset SHAs/Checksums.

Use redis-cluster or redis-sentinel. The [`ioredis`](https://github.com/luin/ioredis) redis library has support for them by default. This allows you to have a High Availability redis configuration.

### Crashing and Safety

```bash
> ./node_modules./bin/actionhero start cluster --workers 1
2016-04-11T18:51:32.891Z - info: actionhero >> start cluster
2016-04-11T18:51:32.904Z - notice:  - STARTING CLUSTER -
2016-04-11T18:51:32.905Z - notice: pid: 43315
2016-04-11T18:51:32.911Z - info: starting worker #1
2016-04-11T18:51:33.097Z - info: [worker #1 (43316)]: starting
2016-04-11T18:51:33.984Z - info: [worker #1 (43316)]: started
2016-04-11T18:51:33.985Z - notice: cluster equilibrium state reached with 1 workers
2016-04-11T18:51:44.775Z - alert: [worker #1 (43316)]: uncaught exception => yay is not defined
2016-04-11T18:51:44.775Z - alert: [worker #1 (43316)]:    ReferenceError: yay is not defined
2016-04-11T18:51:44.775Z - alert: [worker #1 (43316)]:        at Object.exports.action.run (/app/actionhero/actions/bad.js:14:5)
2016-04-11T18:51:44.775Z - alert: [worker #1 (43316)]:        at /app/actionhero/initializers/ActionProcessor.js:268:31
2016-04-11T18:51:44.775Z - alert: [worker #1 (43316)]:        at /app/actionhero/initializers/ActionProcessor.js:149:9
2016-04-11T18:51:44.776Z - alert: [worker #1 (43316)]:        at /app/actionhero/node_modules/async/lib/async.js:726:13
2016-04-11T18:51:44.776Z - alert: [worker #1 (43316)]:        at /app/actionhero/node_modules/async/lib/async.js:52:16
2016-04-11T18:51:44.776Z - alert: [worker #1 (43316)]:        at iterate (/app/actionhero/node_modules/async/lib/async.js:260:24)
2016-04-11T18:51:44.776Z - alert: [worker #1 (43316)]:        at async.forEachOfSeries.async.eachOfSeries (/app/actionhero/node_modules/async/lib/async.js:281:9)
2016-04-11T18:51:44.776Z - alert: [worker #1 (43316)]:        at _parallel (/app/actionhero/node_modules/async/lib/async.js:717:9)
2016-04-11T18:51:44.776Z - alert: [worker #1 (43316)]:        at Object.async.series (/app/actionhero/node_modules/async/lib/async.js:739:9)
2016-04-11T18:51:44.777Z - alert: [worker #1 (43316)]:        at api.ActionProcessor.preProcessAction (/app/actionhero/initializers/ActionProcessor.js:148:13)
2016-04-11T18:51:44.777Z - notice: cluster equilibrium state reached with 1 workers
2016-04-11T18:51:44.785Z - info: [worker #1 (43316)]: exited
2016-04-11T18:51:44.785Z - info: starting worker #1
2016-04-11T18:51:44.960Z - info: [worker #1 (43323)]: starting
2016-04-11T18:51:45.827Z - info: [worker #1 (43323)]: started
2016-04-11T18:51:45.827Z - notice: cluster equilibrium state reached with 1 workers
```

Let the app crash rather than being defensive prematurely. ActionHero has a good logger, and if you are running within `start cluster` mode, your server will be restarted. It is very easy to hide uncaught errors, exceptions, or un-resolved promises, and doing so might leave your application in strange state.

We removed domains from the project in v13 to follow this philosophy, and rely on a parent process (`start cluster`) to handle error logging. Domains are deprecated in node.js now for the same reasons we discuss here.

  * For example, if you timeout connections that are taking too long, what are you going to do about the database connection it was running? Will you roll it back? What about the other clients using the same connection pool? How can you be sure which connection in the mySQL pool was in use? Rather than handle all these edge cases… just let your app crash, log, and reboot.

As noted above, centralized logging (Splunk et al) will be invaluable here. You can can also employ a tool like [BugSnag](https://bugsnag.com) to collect and correlate errors.

### Actions


Remember that all params which come in via the `web` and `socket` servers are `String`s. If you want to typeCast them (perhaps you always know that the param `user_id` will be an integer), you can do so in a middleware or within an action's [`params.formatter`](tutorial-actions.html) step.

Always remember to sanitize any input for SQL injection, etc. The best way to describe this is "never pass a query to your database which can be directly modified via user input"!

Remember that you can restrict actions to specific server types. Perhaps only a web POST request should be able to login, and not a websocket client. You can control application flow this way.

Crafting [authentication middleware is not that hard](https://github.com/actionhero/actionhero-angular-bootstrap-cors-csrf)

### Tasks

Tasks can be created from any part of ActionHero: Actions, Servers, Middleware, even other Tasks.

You can chain tasks together to create workflows.

ActionHero uses the [`multiWorker`](https://github.com/taskrabbit/node-resque#multi-worker) from node-resque. When configured properly, it will consume 100% of a CPU core, to work as many tasks at once as it can. This will also fluctuate depending on the CPU difficulty of the job. Plan accordingly.

Create a way to view the state of your redis cluster. Are you running out of RAM? Are your Queues growing faster than they can be worked? Checking this information is the key to having a healthy ecosystem. [The methods for doing so](tutorial-tasks.html) are available.

Be extra-save within your actions, and do not allow an uncaught exception. This will cause the worker to crash and the job to be remain 'claimed' in redis, and never make it to the failed queue.
