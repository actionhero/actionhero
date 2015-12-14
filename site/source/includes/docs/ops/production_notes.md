# Production Notes

## Topology Example

```javascript

// Assume we use the flag `process.env.ACTIONHERO_ROLE` to denote the type of server
// You can set this variable in the ENV of your server or launch each process with the flag:
// Worker => `ACTIONHERO_ROLE='worker' npm start`
// Server => `ACTIONHERO_ROLE='server' npm start`

// config/tasks.js

exports.production = { 
    tasks: function(api){

        // defualt to config for 'server'
        var config = {
          scheduler: false,
          queues: ['*'],
          verbose: true,
          // ...
          redis: api.config.redis
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

Here is a common actionhero production topology:

![cluster](/images/cluster.png)

Notes:

- It's best to seperate the "workers" from the web "servers"
   - be sure to modify the config files for each type of server acordingly (ie: turn of all servers for the workers, and turn of all workers on the servers)
- To acomplish the above, you only need to make changes to your configuration files on each server.  You will still be running the same same actionhero project codebase.  See the example: 
- Always have a replica of redis!

## Paths and Environments

You can set a few environment variables to affect how actionhero runs:

- `PROJECT_ROOT`: This is useful when deploying actionhero applications on a server where symlinks will change under a running process.  The cluster will look at your symlink `PROJECT_ROOT=/path/to/current_symlink` rather than the absolute path it was started from
- `ACTIONHERO_ROOT`: This can used to set the absolute path to the actionhero binaries
- `ACTIONHERO_CONFIG`: This can be user to set the absolute path to the actionhero config directory you wish to use.  This is useful when you might have a variable configs per server
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

actionhero will write its pid to a pidfile in the normal unix way.  The path for the pidfile is set in `config/api.js` with `config.general.paths.pid`.  

Individual actionhero servers will name their pidfiles by `api.id`, which is determined by the logic [here](https://github.com/evantahler/actionhero/blob/master/initializers/pids.js) and [here](https://github.com/evantahler/actionhero/blob/master/initializers/id.js).  For example, on my laptop with the IP address of `192.168.0.1`, running `npm start` would run one actionhero server and generate a pidfile of `./pids/actionhero-192.168.0.1` in which would be a single line containg the process' pid.

When running the cluster, the cluster process first writes his own pidfile to `process.cwd() + './pids/cluster_pidfile'`.  Then, every worker the cluster master creates will have a pid like `actionhero-worker-1` in the location defined by `config/api.js`.

## Git-based Deployment

```bash
#!/usr/bin/env bash
# assuming the actionhero cluster master process is already running

DEPLOY_PATH=/path/to/your/application

cd $DEPLOY_PATH && git pull
cd $DEPLOY_PATH && npm install
# run any grunt tasks here, like perhaps an asset compile step or a database migration
cd $DEPLOY_PATH && kill -s USR2 `cat pids/cluster_pidfile`
```

To send a signal to the cluster master process to reboot all its workers (`USR2`), you can cat the pidfile (bash):
` kill -s USR2 "cat /path/to/pids/cluster_pidfile"`

If you want to setup a git-based deployment, the simplest steps would be something like => 

## Global Packages

It's probably best to avoid installing any global packages.  This way, you won't have to worry about conflicts, and your project can be kept up to date more easily.  When using npm to install a local package the package's binaries are always copied into `./node_modules/.bin`. 

You can add local references to your $PATH like so to use these local binaries:

`export PATH=$PATH:node_modules/.bin`

## Nginx Example

```javascript
// From `config/servers/web.js`

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

While actionhero can be the font-line server your users hit, it's probably best to proxy actionhero behind a load balancer, nginx, haproxy, etc.  This will help you pool connections before hitting node, SSL terminate, serve static assets, etc.  

Here is an example nginx config for interfacing with actionhero, including using sockets (not http) and handing the websocket upgrade path.

- Note the proxy-pass format to the socket: proxy_pass http://unix:/path/to/socket
- Note some of the extra work you need to have for the websocket upgrade headers (the primus directive)


## Best Practices

As ActionHero is a framework, much of the work for keeping your application secure is dependent on the types of actions and tasks you create.  That said, here is a list of general best-practices for ensuring your deployment is as robust as it can be:

### General Configuration

- Be sure to change `api.config.general.serverToken` to something unique for your application
- Turn off [developer mode](/docs/#development-mode) in production. 
- Turn off `actionDomains` in production.  While domains can *sometimes* save the context of an action, it is very possible to leave the node server in an unknown state when recovering (IE: what if an action modified something on the API object; what if the connection disconnected during domain recovery?).  Yes, an exception will crash the server, but rebooting fresh guarantees safety.

### Topology

- Run a cluster via `startCluster`.  This will guarantee that you can reboot your application with 0 downtime and deploy new versions without interruption.  This will also allow you to turn of `actionDomains` and allow one node to crash while the others continue to server traffic
    - You can run 1 actionhero instance per core (assuming the server is dedicated to actionhero), and that is the default behavior of `startCluster`.
    - You don't need a tool like PM2 to manage actionhero cluster process, but you can.
    - You can use an init script to `startCluster` at boot, or use a tool like [monit](https://mmonit.com/monit/) to do it for you.
- Never run tasks on the same actionhero instances you run your servers on; never run your servers on the same actionhero instances you run your tasks on
    - Yes, under most situations running servers + tasks on the same instance will work OK, but the load profiles (and often the types of packages required) vary in each deployment.  Actions are designed to respond quickly and offload hard computations to tasks.  Tasks are designed to work slower computations.
    - Do any CPU-intensive work in a task.  If a client needs to see the result of a CPU-intensive operation, poll for it (or use web-sockets)
- Use a centralized logging tool like Splunk, ELK, SumoLogic, etc.  ActionHero is *built for the cloud*, which means that it expects pids, application names, etc to change, and as such, will create many log files.  Use a centralized tool to inspect the state of your application.
    - Log everything.  You never know what you might want to check up on.  Actionhero's logger has various levels you can use for this.
- Split out the redis instance you use for cache from the one you use for tasks.  If your cache fills up, do you want task processing to fail?
- Your web request stack should look like: [Load Balancer] -> [App Server] -> [Nginx] -> [ActionHero]
    - This layout allows you to have control, back-pressure and throttling at many layers.
    - Configure Nginx to serve static files whenever possible to remove load from actionhero, and leave it just to process actions
- Use a CDN. Actionhero will serve static files with the proper last-modified headers, so your CDN should respect this, and you should not need to worry about asset SHAs/Checksums.
- Use redis-cluster or redis-sentinel.  The [`ioredis`](https://github.com/luin/ioredis) redis library has support for them by default.  This allows you to have a High Availability redis configuration. 

### Actions

- Remember that all params which come in via the `web` and `socket` servers are `String`s.  If you want to typeCast them (perhaps you always know that the param `user_id` will be an integer), you can do so in a middleware or within an action's [`params.formatter`](/docs/#inputs) step. 
- Always remember to sanitize any input for SQL injection, etc.  The best way to describe this is "never pass a query to your database which can be directly modified via user input"!
- Remember that you can restrict actions to specific server types.  Perhaps only a web POST request should be able to login, and not a websocket client.  You can control application flow this way.
- Crafting [authentication middleware is not that hard](https://github.com/evantahler/actionhero-angular-bootstrap-cors-csrf)

### Tasks

- Tasks can be created from any part of actionhero: Actions, Servers, Middleware, even other Tasks.
- You can chain tasks together to create workflows.  
- Actionhero uses the [`multiWorker`](https://github.com/taskrabbit/node-resque#multi-worker) from node-resque.  When configured properly, it will consume 100% of a CPU core, to work as many tasks at once as it can.  This will also fluctuate depending on the CPU difficulty of the job.  Plan accordingly.
- Create a way to view the state of your redis cluster.  Are you running out of RAM?  Are your Queues growing faster than they can be worked?  Checking this information is the key to having a healthy ecosystem.  [The methods for doing so](/docs/#queue-inspection) are available.
- Be extra-save within your actions, and do not allow an uncaught exception.  This will cause the worker to crash and the job to be remain 'claimed' in redis, and never make it to the failed queue.

